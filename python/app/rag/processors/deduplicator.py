from langchain_core.documents import Document


def deduplicate_documents(documents: list[Document] | list[tuple[Document, float]]) -> list[Document]:
    seen = set()
    deduplicated = []

    for item in documents:
        doc = item[0] if isinstance(item, tuple) else item
        content = doc.page_content.strip()

        if content not in seen:
            seen.add(content)
            deduplicated.append(doc)

    return deduplicated
