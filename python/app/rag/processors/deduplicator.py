from langchain_core.documents import Document


def deduplicate_documents(documents: list[Document]) -> list[Document]:
    seen = set()
    deduplicated = []

    for doc in documents:
        content = doc.page_content.strip()
        if content not in seen:
            seen.add(content)
            deduplicated.append(doc)

    return deduplicated
