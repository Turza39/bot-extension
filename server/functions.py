from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from langchain.schema import Document
from pathlib import Path
import re, json
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e)
            }
        )

def clean_text(text: str) -> str:
    text = re.sub(r'\n+', '\n', text)         
    text = re.sub(r'[ \t]+', ' ', text)      
    text = text.strip()                 
    return text

class URLRequest(BaseModel):
    url: str

@app.post("/embed")
async def get_url_chunk_embedd(request: URLRequest):
    try:
        loader = WebBaseLoader(request.url)
        docs = loader.load()

        if not docs:
            return JSONResponse(
                content={"status": "error", "message": "No content found on the webpage"},
                status_code=400
            )

        processed_docs = []
        for doc in docs:
            cleaned_content = clean_text(doc.page_content)
            if cleaned_content: 
                doc.page_content = cleaned_content
                processed_docs.append(doc)

        if not processed_docs:
            return JSONResponse(
                content={"status": "error", "message": "No valid content found after processing"},
                status_code=400
            )

        splitter = RecursiveCharacterTextSplitter(
            chunk_size = 1000,
            chunk_overlap = 200,
            length_function = len,
            add_start_index = True,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(processed_docs)

        if not chunks:
            return JSONResponse(
                content={"status": "error", "message": "No content chunks generated"},
                status_code=400
            )

        embedding_model = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        vectorestore = FAISS.from_documents(chunks, embedding_model)

        # Currently we are using local storage to save the embeddings
        vectorestore.save_local("./url_vectorstore")
        
        return JSONResponse(
            content={"status": "success", "message": "Content processed successfully"},
            status_code=200
        )
    except Exception as e:
        return JSONResponse(
            content={"status": "error", "message": "Unable to process the webpage content"},
            status_code=500
        )

def chat_history_embed(chat_history: json, embedding_model):
    if not chat_history:
        return None
        
    docs = []
    for chat in chat_history[-5:]:
        text = f"role: {chat['role']}: {chat['content']}"
        docs.append(Document(page_content=text, metadata = {"role": chat["role"]}))

    if not docs:
        return None

    splitter = RecursiveCharacterTextSplitter(
        chunk_size = 1000,
        chunk_overlap = 200,
        length_function = len,
        add_start_index = True,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_documents(docs)

    if not chunks:
        return None

    try:
        return FAISS.from_documents(chunks, embedding_model)
    except Exception as e:
        print(f"Error creating chat history embeddings: {e}")
        return None


class AskRequest(BaseModel):
    qsn: str
    api_key: str
    chat_history: Optional[List[Dict[str, str]]] = None

@app.post("/ask")
async def query(request: AskRequest):
    if not request.api_key:
        return JSONResponse(content={"error": "API key is required"}, status_code=400)

    embedding_model = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    context = ""
    relevant_docs = []

    path = Path("./url_vectorstore")
    if path.exists():
        try:
            vectorestore = FAISS.load_local(str(path), embedding_model, allow_dangerous_deserialization=True)
            retriever = vectorestore.as_retriever(search_kwargs={"k": 5})
            relevant_docs = retriever.get_relevant_documents(request.qsn)
        except Exception as e:
            print(f"Error accessing vector store: {e}")

    if request.chat_history:
        try:
            chat_vector = chat_history_embed(request.chat_history, embedding_model)
            if chat_vector:
                chat_retriever = chat_vector.as_retriever(search_kwargs={"k": 5})
                chat_docs = chat_retriever.get_relevant_documents(request.qsn)
                if chat_docs:
                    relevant_docs.extend(chat_docs)
        except Exception as e:
            print(f"Error processing chat history: {e}")

    if relevant_docs:
        context = "\n".join([doc.page_content for doc in relevant_docs])

    if context:
        prompt = f"""Answer the following question. If the provided context is relevant, use it to inform your answer. Otherwise, answer from your own knowledge.

Context:
{context}

Question: {request.qsn}

Important: If the context isn't relevant to the question, simply answer from your knowledge without mentioning the context."""
    else:
        prompt = f"""Question: {request.qsn}

Please provide a helpful and accurate answer based on your knowledge."""

    chat_model = ChatGoogleGenerativeAI(
        model='gemini-2.5-pro',
        temperature=0.8,
        google_api_key=request.api_key
    )

    try:
        response = chat_model.invoke(prompt)
        return JSONResponse(
            content={
                "answer": response.content,
                "status": "success"
            },
            status_code=200
        )
    except Exception as e:
        return JSONResponse(
            content={
                "error": str(e),
                "status": "error"
            },
            status_code=500
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "functions:app",
        host="127.0.0.1", 
        port=8000,
        reload=True  
    )