import requests

def test_sse():
    import urllib.parse
    idea = "Smart Inventory Management for Retail"
    encoded_idea = urllib.parse.quote(idea)
    url = f"http://localhost:3001/debate?idea={encoded_idea}"
    print(f"Connecting to {url}...")
    try:
        response = requests.get(url, stream=True)
        for line in response.iter_lines():
            if line:
                print(line.decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_sse()
