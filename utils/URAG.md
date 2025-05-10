# Unstructured RAG Implementation Checklist

## Document Processing Setup

- [ ] Install required dependencies
  - [ ] `pip install unstructured[all-docs] langchain chromadb langchain_community`
  - [ ] `pip install torch transformers accelerate bitsandbytes sentence-transformers`
  - [ ] Install OS-specific dependencies:
    - [ ] Linux: `apt-get install tesseract-ocr poppler-utils libmagic-dev`
    - [ ] macOS: `brew install tesseract poppler libmagic`
    - [ ] Windows: Install Tesseract and add to PATH

- [ ] Create document storage structure
  - [ ] `mkdir -p "./documents/raw"` (original files)
  - [ ] `mkdir -p "./documents/processed"` (processed elements)
  - [ ] `mkdir -p "./documents/chunks"` (chunked content)
  - [ ] `mkdir -p "./vector_db"` (vector database storage)

## Document Collection

- [ ] Gather documents from various sources
  - [ ] PDF documents
    - [ ] Extract text from scanned PDFs using OCR
    - [ ] Process tables with table extraction
  - [ ] PowerPoint presentations
    - [ ] Extract slide content and notes
    - [ ] Process embedded images
  - [ ] EPUB files
    - [ ] Handle chapter/section structure
  - [ ] HTML pages
    - [ ] Clean HTML and extract main content
    - [ ] Process tables and lists
  - [ ] Word documents
    - [ ] Extract headers and structure
    - [ ] Process embedded images
  - [ ] Markdown files
    - [ ] Preserve formatting and structure
  - [ ] Emails
    - [ ] Separate headers from body
    - [ ] Process attachments

## Unstructured Data Preprocessing

- [ ] Configure Unstructured preprocessing
  - [ ] Set up logging
    ```python
    import logging
    logging.basicConfig(level=logging.INFO, 
                        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ```
  - [ ] Configure processor settings
    ```python
    from unstructured.staging.base import elements_from_json
    from unstructured.partition.auto import partition
    ```
  - [ ] Set up read configuration
    ```python
    read_config = {
        "strategy": "fast",
        "languages": ["eng"]
    }
    ```
  - [ ] Set up partition configuration
    ```python
    partition_config = {
        "include_page_breaks": True,
        "include_metadata": True,
        "hi_res_model_name": "yolox"
    }
    ```
  - [ ] Configure local connector
    ```python
    from unstructured.documents.elements import Text, Title
    from unstructured.partition.html import partition_html
    ```

- [ ] Process documents with Unstructured
  - [ ] Create document processing function
    ```python
    def process_document(file_path, output_dir):
        elements = partition(
            filename=file_path,
            **partition_config,
            **read_config
        )
        output_file = os.path.join(
            output_dir, 
            f"{os.path.basename(file_path)}.json"
        )
        with open(output_file, "w") as f:
            json.dump([e.to_dict() for e in elements], f)
        return elements
    ```
  - [ ] Process all documents in batch
    ```python
    import glob
    for file_path in glob.glob("./documents/raw/*.*"):
        process_document(file_path, "./documents/processed")
    ```
  - [ ] Extract elements from processed JSON files
    ```python
    def load_processed_elements(json_file):
        with open(json_file, "r") as f:
            data = json.load(f)
        return elements_from_json(data)
    ```

## Document Chunking

- [ ] Configure chunking strategy
  - [ ] Define chunk size parameters
    ```python
    MAX_CHUNK_SIZE = 512  # characters
    MIN_CHUNK_SIZE = 200  # characters for combining
    CHUNK_OVERLAP = 50    # overlap between chunks
    ```
  - [ ] Create utility functions for text length
    ```python
    def get_text_length(element):
        return len(element.text) if hasattr(element, 'text') else 0
    ```
  
- [ ] Apply chunking to document elements
  - [ ] Create title-based chunking function
    ```python
    def chunk_by_title(elements):
        chunks = []
        current_title = None
        current_texts = []
        
        for element in elements:
            if isinstance(element, Title):
                # Save previous chunk if exists
                if current_texts and current_title:
                    chunks.append({
                        "title": current_title,
                        "text": "\n".join(current_texts),
                        "metadata": element.metadata
                    })
                
                # Start new chunk
                current_title = element.text
                current_texts = []
            elif hasattr(element, 'text'):
                current_texts.append(element.text)
        
        # Add the last chunk
        if current_texts and current_title:
            chunks.append({
                "title": current_title,
                "text": "\n".join(current_texts),
                "metadata": elements[-1].metadata if elements else {}
            })
            
        return chunks
    ```
  - [ ] Implement size-based chunking
    ```python
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=MAX_CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    ```
  - [ ] Apply hybrid chunking approach
    ```python
    def create_document_chunks(elements):
        title_chunks = chunk_by_title(elements)
        
        final_chunks = []
        for chunk in title_chunks:
            if len(chunk["text"]) <= MAX_CHUNK_SIZE:
                final_chunks.append(chunk)
            else:
                texts = text_splitter.split_text(chunk["text"])
                for i, text in enumerate(texts):
                    final_chunks.append({
                        "title": f"{chunk['title']} (part {i+1})",
                        "text": text,
                        "metadata": chunk["metadata"]
                    })
        
        return final_chunks
    ```

## Vector Storage Setup

- [ ] Prepare documents for embedding
  - [ ] Convert chunked elements to LangChain documents
    ```python
    from langchain_community.docstore.document import Document
    
    def chunks_to_langchain_docs(chunks):
        docs = []
        for chunk in chunks:
            metadata = chunk.get("metadata", {}).copy()
            metadata["title"] = chunk.get("title", "")
            
            doc = Document(
                page_content=chunk["text"],
                metadata=metadata
            )
            docs.append(doc)
        return docs
    ```
  - [ ] Clean metadata for compatibility with vector store
    ```python
    def clean_metadata(docs):
        for doc in docs:
            # Remove non-serializable objects
            for key in list(doc.metadata.keys()):
                if not isinstance(doc.metadata[key], (str, int, float, bool, list, dict, type(None))):
                    doc.metadata[key] = str(doc.metadata[key])
            
            # Ensure source field exists
            if "source" not in doc.metadata and "filename" in doc.metadata:
                doc.metadata["source"] = doc.metadata["filename"]
        
        return docs
    ```

- [ ] Configure vector database
  - [ ] Set up ChromaDB with proper settings
    ```python
    from langchain_community.vectorstores import Chroma
    from langchain_community.embeddings import HuggingFaceEmbeddings
    
    # Initialize embedding model
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-base-en-v1.5",
        model_kwargs={"device": "cuda" if torch.cuda.is_available() else "cpu"},
        encode_kwargs={"normalize_embeddings": True}
    )
    
    # Configure persistence settings
    persist_directory = "./vector_db"
    ```
  - [ ] Initialize vector store with error handling
    ```python
    def initialize_vector_db(docs, embedding_model, persist_dir):
        try:
            # Create new vector store
            vector_db = Chroma.from_documents(
                documents=docs,
                embedding=embedding_model,
                persist_directory=persist_dir
            )
            vector_db.persist()
            logging.info(f"Vector DB created with {len(docs)} documents")
            return vector_db
        except Exception as e:
            logging.error(f"Error creating vector DB: {str(e)}")
            raise
    ```
  
- [ ] Create vector embeddings
  - [ ] Set up batching for large document sets
    ```python
    def batch_embed_documents(docs, batch_size=64):
        total_docs = len(docs)
        batched_docs = []
        
        for i in range(0, total_docs, batch_size):
            end_idx = min(i + batch_size, total_docs)
            batch = docs[i:end_idx]
            batched_docs.append(batch)
            logging.info(f"Prepared batch {i//batch_size + 1} with {len(batch)} documents")
        
        return batched_docs
    ```
  - [ ] Process embeddings with progress tracking
    ```python
    from tqdm import tqdm
    
    def create_vector_db_batched(docs, embedding_model, persist_dir, batch_size=64):
        batched_docs = batch_embed_documents(docs, batch_size)
        
        # Process first batch to initialize DB
        vector_db = Chroma.from_documents(
            documents=batched_docs[0],
            embedding=embedding_model,
            persist_directory=persist_dir
        )
        vector_db.persist()
        
        # Add remaining batches
        for i, batch in enumerate(tqdm(batched_docs[1:], desc="Embedding batches")):
            vector_db.add_documents(batch)
            vector_db.persist()
            logging.info(f"Added batch {i+2}/{len(batched_docs)}")
        
        return vector_db
    ```

## Retriever Configuration

- [ ] Set up document retriever
  - [ ] Configure basic similarity search retriever
    ```python
    def create_basic_retriever(vector_db, k=3):
        return vector_db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k}
        )
    ```
  - [ ] Implement advanced retriever with filters
    ```python
    def create_filtered_retriever(vector_db, k=3):
        return vector_db.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={
                "k": k,
                "score_threshold": 0.5,  # Adjust based on your embedding model
                "filter": None  # Can be configured with metadata filters
            }
        )
    ```
  - [ ] Create test query function
    ```python
    def test_retrieval(retriever, query):
        docs = retriever.get_relevant_documents(query)
        print(f"Retrieved {len(docs)} documents for query: '{query}'")
        for i, doc in enumerate(docs):
            print(f"\nDOCUMENT {i+1}:")
            print(f"Source: {doc.metadata.get('source', 'Unknown')}")
            print(f"Title: {doc.metadata.get('title', 'Untitled')}")
            print(f"Content: {doc.page_content[:150]}...")
        return docs
    ```

## LLM Integration

- [ ] Select and configure LLM
  - [ ] Set up model with proper quantization
    ```python
    from langchain_community.llms import HuggingFacePipeline
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    
    # Model settings
    MODEL_ID = "meta-llama/Llama-3-8b-instruct"
    QUANTIZATION = "4bit"  # Options: None, "4bit", "8bit"
    
    def initialize_llm():
        # Configure tokenizer
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        
        # Configure model with quantization
        model_kwargs = {"device_map": "auto"}
        if QUANTIZATION == "4bit":
            model_kwargs.update({
                "load_in_4bit": True,
                "quantization_config": {
                    "bnb_4bit_compute_dtype": "float16"
                }
            })
        elif QUANTIZATION == "8bit":
            model_kwargs["load_in_8bit"] = True
        
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID, 
            **model_kwargs
        )
        
        return tokenizer, model
    ```
  - [ ] Set up generation pipeline
    ```python
    def create_generation_pipeline(tokenizer, model):
        # Configure text generation pipeline
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=1024,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        # Create LangChain wrapper
        llm = HuggingFacePipeline(pipeline=pipe)
        
        return llm
    ```

## RAG Implementation

- [ ] Create prompt template
  - [ ] Design context-aware prompt
    ```python
    from langchain.prompts import PromptTemplate
    
    RAG_PROMPT = """You are a helpful assistant that answers questions based on the provided context.
    
    CONTEXT:
    {context}
    
    QUESTION:
    {query}
    
    INSTRUCTIONS:
    - Answer the question based only on the provided context.
    - If the context doesn't contain enough information, say "I don't have enough information to answer this question."
    - Don't invent or assume information that's not in the context.
    - Cite the sources of your information.
    
    YOUR ANSWER:"""
    
    prompt_template = PromptTemplate(
        input_variables=["context", "query"],
        template=RAG_PROMPT
    )
    ```

- [ ] Build RAG chain
  - [ ] Combine retriever with LLM using LangChain
    ```python
    from langchain.chains import RetrievalQA
    
    def create_rag_chain(llm, retriever):
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",  # Other options: "map_reduce", "refine"
            retriever=retriever,
            chain_type_kwargs={
                "prompt": prompt_template
            },
            return_source_documents=True
        )
        return qa_chain
    ```
  - [ ] Set up response handling
    ```python
    def query_rag_system(qa_chain, query):
        try:
            result = qa_chain({"query": query})
            answer = result["result"]
            source_docs = result["source_documents"]
            
            # Format sources for display
            sources = []
            for doc in source_docs:
                source = doc.metadata.get("source", "Unknown")
                title = doc.metadata.get("title", "Untitled")
                sources.append(f"- {title} ({source})")
                
            sources_text = "\n".join(sources)
            
            return {
                "answer": answer,
                "sources": sources_text,
                "raw_sources": source_docs
            }
        except Exception as e:
            logging.error(f"Error querying RAG system: {str(e)}")
            return {
                "answer": "Sorry, I encountered an error while processing your query.",
                "sources": "",
                "raw_sources": []
            }
    ```

## Testing and Validation

- [ ] Develop test queries
  - [ ] Create diverse test question set
    ```python
    TEST_QUERIES = [
        "What is the main goal of this project?",
        "Can you explain the key components of the system?",
        "What are the limitations of the approach described?",
        "Who authored this document and when?",
        "What metrics are used to evaluate performance?",
        "How does this compare to alternative approaches?"
    ]
    ```
  - [ ] Implement automated testing
    ```python
    def run_test_suite(qa_chain):
        results = []
        for query in TEST_QUERIES:
            print(f"\nTesting query: '{query}'")
            result = query_rag_system(qa_chain, query)
            print(f"Answer: {result['answer']}")
            print(f"Sources:\n{result['sources']}")
            results.append(result)
        return results
    ```

- [ ] Evaluate responses
  - [ ] Implement basic evaluation metrics
    ```python
    def evaluate_responses(results):
        # Basic evaluation
        total = len(results)
        with_sources = sum(1 for r in results if r["sources"])
        avg_sources = sum(len(r["raw_sources"]) for r in results) / total
        
        print(f"\nEVALUATION RESULTS:")
        print(f"Total queries: {total}")
        print(f"Responses with sources: {with_sources} ({with_sources/total:.1%})")
        print(f"Average sources per query: {avg_sources:.1f}")
        
        # You would typically have human evaluation here
        print("\nNext steps: Conduct human evaluation of response quality")
    ```

## Improvements and Optimizations

- [ ] Implement advanced retrieval methods
  - [ ] Set up hybrid search combining BM25 and vectors
    ```python
    from langchain.retrievers import BM25Retriever, EnsembleRetriever
    
    def create_hybrid_retriever(vector_db, documents, k=3):
        # Create BM25 retriever
        bm25_retriever = BM25Retriever.from_documents(documents)
        bm25_retriever.k = k
        
        # Create vector retriever
        vector_retriever = vector_db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k}
        )
        
        # Combine retrievers
        ensemble_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, vector_retriever],
            weights=[0.5, 0.5]
        )
        
        return ensemble_retriever
    ```
  - [ ] Implement query rewriting for improved retrieval
    ```python
    def query_rewriter(llm, query):
        REWRITE_PROMPT = """Given the user query below, rewrite it to make it more effective for retrieval from a knowledge base.
        Make it more specific and include potential keywords that might help with retrieval.
        
        Original query: {query}
        
        Rewritten query:"""
        
        prompt = PromptTemplate(
            input_variables=["query"],
            template=REWRITE_PROMPT
        )
        
        rewrite_chain = prompt | llm
        rewritten_query = rewrite_chain.invoke({"query": query})
        
        logging.info(f"Original query: {query}")
        logging.info(f"Rewritten query: {rewritten_query}")
        
        return rewritten_query
    ```

- [ ] Add source document return
  - [ ] Create citation formatter
    ```python
    def format_citations(source_docs):
        citations = []
        for i, doc in enumerate(source_docs):
            source = doc.metadata.get("source", "Unknown source")
            title = doc.metadata.get("title", "Untitled")
            page = doc.metadata.get("page", "")
            page_str = f" (page {page})" if page else ""
            
            citations.append(f"[{i+1}] {title}{page_str} - {source}")
        
        return "\n".join(citations)
    ```
  - [ ] Implement source highlighting
    ```python
    def highlight_source_text(query, source_docs):
        from difflib import SequenceMatcher
        
        highlighted_sources = []
        
        for doc in source_docs:
            text = doc.page_content
            title = doc.metadata.get("title", "Untitled")
            
            # Find best matching segment
            best_match = None
            best_score = 0
            
            # Split into sentences for better matching
            sentences = text.split(". ")
            for i in range(len(sentences)):
                # Check different window sizes
                for window in range(1, min(5, len(sentences) - i + 1)):
                    segment = ". ".join(sentences[i:i+window])
                    score = SequenceMatcher(None, query.lower(), segment.lower()).ratio()
                    
                    if score > best_score:
                        best_score = score
                        best_match = segment
            
            if best_match and best_score > 0.15:  # Threshold for relevance
                highlighted_text = text.replace(best_match, f"**{best_match}**")
                highlighted_sources.append({
                    "title": title,
                    "text": highlighted_text,
                    "relevance": best_score
                })
            else:
                highlighted_sources.append({
                    "title": title,
                    "text": text[:300] + "...",  # Show first part if no match
                    "relevance": best_score
                })
        
        # Sort by relevance
        highlighted_sources.sort(key=lambda x: x["relevance"], reverse=True)
        return highlighted_sources
    ```

- [ ] Optimize performance
  - [ ] Benchmark and optimize retrieval speed
    ```python
    import time
    
    def benchmark_retrieval(retriever, queries, runs=3):
        results = []
        
        for query in queries:
            query_times = []
            for _ in range(runs):
                start_time = time.time()
                docs = retriever.get_relevant_documents(query)
                query_time = time.time() - start_time
                query_times.append(query_time)
            
            avg_time = sum(query_times) / runs
            results.append({
                "query": query,
                "avg_time": avg_time,
                "num_docs": len(docs)
            })
        
        # Report results
        print("\nRETRIEVAL BENCHMARK RESULTS:")
        for result in results:
            print(f"Query: '{result['query']}'")
            print(f"  Average time: {result['avg_time']:.3f}s")
            print(f"  Documents retrieved: {result['num_docs']}")
        
        overall_avg = sum(r["avg_time"] for r in results) / len(results)
        print(f"\nOverall average retrieval time: {overall_avg:.3f}s")
        
        return results
    ```
  - [ ] Implement caching for frequent queries
    ```python
    import functools
    
    # Create LRU cache for retrieval results
    @functools.lru_cache(maxsize=100)
    def cached_retrieval(query_str):
        # Convert query to string for hashability
        return retriever.get_relevant_documents(query_str)
        
    # Usage function
    def get_documents_cached(query):
        return cached_retrieval(query)
    ```

## Deployment Considerations

- [ ] Prepare for production
  - [ ] Create system documentation
    ```python
    def generate_system_doc():
        doc = f"""# RAG System Documentation
        
        ## System Overview
        - Embedding model: {embeddings.model_name}
        - Vector database: ChromaDB
        - LLM model: {MODEL_ID}
        - Quantization: {QUANTIZATION}
        
        ## Document Statistics
        - Total documents processed: {vector_db._collection.count()}
        - Vector dimensions: {embeddings.client.get_sentence_embedding_dimension()}
        
        ## Usage Instructions
        1. Import the RAG system
        2. Initialize with `initialize_rag()`
        3. Query with `query_rag_system(rag_chain, "your query")`
        
        ## Maintenance
        - Reindex documents: `reindex_documents()`
        - Update vector store: `update_vector_store()`
        - Backup database: `backup_vector_store()`
        """
        
        with open("rag_system_documentation.md", "w") as f:
            f.write(doc)
    ```
  - [ ] Create backup strategy for vector store
    ```python
    import shutil
    from datetime import datetime
    
    def backup_vector_store(source_dir="./vector_db"):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = f"./backups/vector_db_{timestamp}"
        
        # Create backup directory
        os.makedirs("./backups", exist_ok=True)
        
        # Copy vector store files
        shutil.copytree(source_dir, backup_dir)
        
        logging.info(f"Backed up vector store to {backup_dir}")
        return backup_dir
    ```

- [ ] Scale system
  - [ ] Implement distributed vector storage
    ```python
    # Example code for using distributed Chroma
    from chromadb.config import Settings
    
    def initialize_distributed_chroma():
        import chromadb
        
        # Connect to Chroma server
        client = chromadb.HttpClient(
            host="chroma-server",
            port=8000,
            settings=Settings(
                anonymized_telemetry=False
            )
        )
        
        # Create or get collection
        collection = client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        
        return client, collection
    ```
  - [ ] Create document update strategy
    ```python
    def update_documents(new_docs, vector_db):
        # Get document IDs from metadata if available
        doc_ids = []
        for doc in new_docs:
            doc_id = doc.metadata.get("doc_id")
            if not doc_id:
                # Generate consistent ID if not available
                doc_id = f"doc_{hash(doc.page_content)}"
                doc.metadata["doc_id"] = doc_id
            doc_ids.append(doc_id)
        
        # Add documents with IDs
        vector_db.add_documents(
            documents=new_docs,
            ids=doc_ids
        )
        vector_db.persist()
        
        logging.info(f"Added/updated {len(new_docs)} documents to vector store")
    ```

## Future Enhancements

- [ ] Explore iterative query refinement
  - [ ] Implement query clarification module
    ```python
    def get_query_clarification(llm, query, context):
        CLARIFY_PROMPT = """Based on the user's query and the context retrieved, suggest up to 3 clarifying questions that would help provide a more accurate answer.
        
        USER QUERY: {query}
        
        CONTEXT SUMMARY: {context}
        
        CLARIFYING QUESTIONS:
        1."""
        
        # Generate clarifying questions
        clarify_prompt = PromptTemplate(
            input_variables=["query", "context"],
            template=CLARIFY_PROMPT
        )
        
        context_summary = "\n".join([doc.page_content[:100] + "..." for doc in context[:2]])
        clarification = llm.invoke(
            clarify_prompt.format(
                query=query,
                context=context_summary
            )
        )
        
        return clarification
    ```

- [ ] Add metadata filtering capabilities
  - [ ] Create filter builder utility
    ```python
    def build_metadata_filter(filter_dict):
        """
        Build a metadata filter for ChromaDB retrieval.
        
        Example:
        build_metadata_filter({
            "document_type": "pdf",
            "date_range": {"$gte": "2023-01-01", "$lte": "2023-12-31"},
            "author": {"$in": ["Alice", "Bob"]}
        })
        """
        # Validate filter dict
        if not isinstance(filter_dict, dict):
            raise ValueError("Filter must be a dictionary")
            
        # Convert to ChromaDB filter format
        chroma_filter = {}
        for key, value in filter_dict.items():
            if isinstance(value, dict) and any(k.startswith("$") for k in value.keys()):
                # Handle operators
                for op, op_value in value.items():
                    if op == "$in":
                        chroma_filter[key] = {"$in": op_value}
                    elif op == "$gte":
                        chroma_filter[key] = {"$gte": op_value}
                    elif op == "$lte":
                        chroma_filter[key] = {"$lte": op_value}
                    # Add more operators as needed
            else:
                # Simple equality
                chroma_filter[key] = value
                
        return chroma_filter
    ```

- [ ] Implement automatic document updating
  - [ ] Create document change detection
    ```python
    def detect_document_changes(doc_dir, known_files=None):
        import hashlib
        
        if known_files is None:
            known_files = {}
            
        current_files = {}
        new_files = []
        changed_files = []
        
        # Scan directory for files
        for root, _, files in os.walk(doc_dir):
            for filename in files:
                file_path = os.path.join(root, filename)
                
                # Skip non-document files
                if not any(filename.endswith(ext) for ext in 
                          ['.pdf', '.docx', '.txt', '.md', '.html']):
                    continue
                    
                # Calculate file hash
                with open(file_path, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
                
                current_files[file_path] = file_hash
                
                # Check if file is new or changed
                if file_path not in known_files:
                    new_files.append(file_path)
                elif known_files[file_path] != file_hash:
                    changed_files.append(file_path)
        
        return {
            "current_files": current_files,
            "new_files": new_files,
            "changed_files": changed_files
        }
    ```

- [ ] Consider multi-modal document processing
  - [ ] Add image processing capability
    ```python
    def extract_text_from_images(image_paths):
        # Requires pytesseract and PIL
        import pytesseract
        from PIL import Image
        
        results = []
        
        for image_path in image_paths:
            try:
                img = Image.open(image_path)
                text = pytesseract.image_to_string(img)
                
                results.append({
                    "source": image_path,
                    "text": text,
                    "metadata": {
                        "content_type": "image",
                        "filename": os.path.basename(image_path)
                    }
                })
            except Exception as e:
                logging.error(f"Error processing image {image_path}: {str(e)}")
        
        return results
    ```
