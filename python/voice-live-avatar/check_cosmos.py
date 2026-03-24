import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from azure.cosmos.aio import CosmosClient


async def check():
    endpoint = os.getenv("COSMOS_ENDPOINT")
    key = os.getenv("COSMOS_KEY")
    db_name = os.getenv("COSMOS_DATABASE")
    container_name = os.getenv("COSMOS_CONTAINER")
    print(f"Endpoint : {endpoint}")
    print(f"Database : {db_name}")
    print(f"Container: {container_name}")

    if key:
        credential = key
        print("Auth     : Key")
    else:
        from azure.identity.aio import DefaultAzureCredential
        credential = DefaultAzureCredential()
        print("Auth     : DefaultAzureCredential (AAD)")

    async with CosmosClient(endpoint, credential=credential) as client:
        db = client.get_database_client(db_name)
        container = db.get_container_client(container_name)
        items = []
        async for item in container.query_items(
            query="SELECT c.id, c.avatar, c.sessionId, c.role, c.content, c.timestamp FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT 10",
        ):
            items.append(item)

        if items:
            print(f"\nFound {len(items)} recent item(s):")
            for i in items:
                preview = i["content"][:80]
                print(f"  [{i['timestamp']}] ({i['role']}) avatar={i.get('avatar','?')} | {preview}")
        else:
            print("\nNo items found in container.")


asyncio.run(check())
