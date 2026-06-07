import asyncio
from pydantic import BaseModel
import ollama

class TestSchema(BaseModel):
    status: str
    message: str

async def test_model(model_name: str):
    print(f"\n--- Testing model: {model_name} ---")
    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model_name,
            messages=[{"role": "user", "content": "Say hello and confirm you are working. Output JSON with status and message fields."}],
            stream=False,
            format=TestSchema.model_json_schema(),
            options={"num_ctx": 4096}
        )
        content = response['message']['content']
        print(f"Raw Output:\n{content}")
        
        parsed = TestSchema.model_validate_json(content)
        print(f"Parsed Successfully:\n{parsed.model_dump()}")
        return True
    except Exception as e:
        print(f"Error testing {model_name}: {e}")
        return False

async def main():
    models = ["phi3:mini", "qwen2:1.5b", "smollm2:1.7b"]
    successes = 0
    
    for model in models:
        success = await test_model(model)
        if success:
            successes += 1
            
    print(f"\nTested {len(models)} models, {successes} succeeded.")

if __name__ == "__main__":
    asyncio.run(main())
