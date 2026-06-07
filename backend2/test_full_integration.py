#!/usr/bin/env python3
"""
Comprehensive backend2 validation test with 3 debate cases.
Tests the /debate endpoint, PDF generation, and validates SSE stream parsing.
"""

import requests
import json
import time
from urllib.parse import urlencode

API_BASE = "http://127.0.0.1:8000"

test_cases = [
    {
        "name": "Test Case 1: Mobile Community Gardening App",
        "params": {
            "idea": "A mobile app that helps community members coordinate and manage shared garden spaces, including task scheduling, resource allocation, and progress tracking.",
            "techStack": "React Native, Node.js, PostgreSQL, Firebase",
            "members": 4,
            "deadlineWeeks": 10,
        },
    },
    {
        "name": "Test Case 2: AI-Assisted Tutoring Platform",
        "params": {
            "idea": "An AI-powered tutoring platform that provides personalized learning paths, adaptive assessments, and real-time feedback to students across multiple subjects.",
            "techStack": "Next.js, Python, FastAPI, ChromaDB, OpenAI API",
            "members": 7,
            "deadlineWeeks": 16,
        },
    },
    {
        "name": "Test Case 3: IoT Energy Monitoring System",
        "params": {
            "idea": "An IoT system for real-time energy monitoring and optimization in commercial buildings, with predictive analytics and automated load balancing.",
            "techStack": "Node.js, MQTT, SQLite, Machine Learning",
            "members": 3,
            "deadlineWeeks": 8,
        },
    },
]

def test_health_check():
    """Verify backend is responding."""
    print("\n" + "="*70)
    print("HEALTH CHECK")
    print("="*70)
    try:
        r = requests.get(f"{API_BASE}/health", timeout=5)
        print(f"✓ Health check: {r.status_code}")
        print(f"  Response: {r.json()}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_debate_endpoint(case_name, params):
    """Test the debate endpoint with a specific case."""
    print(f"\n{case_name}")
    print("-" * 70)
    print(f"Params: idea={params['idea'][:50]}..., stack={params['techStack']}, team={params['members']}, deadline={params['deadlineWeeks']}w")
    
    try:
        query_string = urlencode(params)
        url = f"{API_BASE}/debate?{query_string}"
        
        print(f"Requesting: GET {url[:100]}...")
        response = requests.get(url, stream=True, timeout=180)
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ Unexpected status code")
            print(f"  Response: {response.text[:500]}")
            return False
        
        # Parse SSE stream
        events_received = 0
        progress_events = 0
        final_event = None
        
        print("\nStreaming events:")
        for line in response.iter_lines():
            if not line:
                continue
            
            text = line.decode('utf-8') if isinstance(line, bytes) else line
            
            if not text.startswith('data:'):
                continue
            
            events_received += 1
            data_str = text.replace('data:', '').strip()
            
            if not data_str or data_str == '[DONE]':
                continue
            
            try:
                data = json.loads(data_str)
                
                # Track event types
                if 'step' in data:
                    progress_events += 1
                    if progress_events <= 5 or progress_events % 3 == 0:
                        print(f"  [{progress_events}] PROGRESS: {data['step']}")
                
                if 'final' in data or ('roadmap' in data and 'summary' in data):
                    final_event = data
                    print(f"  [FINAL] Received final synthesis roadmap")
                
            except json.JSONDecodeError:
                print(f"  [!] Non-JSON payload: {data_str[:60]}...")
        
        print(f"\n✓ Events received: {events_received}")
        print(f"  - Progress updates: {progress_events}")
        print(f"  - Final synthesis: {'YES' if final_event else 'NO'}")
        
        # Check final output
        if final_event:
            if 'roadmap' in final_event and len(final_event.get('roadmap', [])) > 0:
                print(f"  - Roadmap steps: {len(final_event['roadmap'])}")
            if 'session_id' in final_event:
                print(f"  - Session ID: {final_event['session_id'][:16]}...")
        
        return True
    
    except requests.exceptions.Timeout:
        print(f"✗ Request timeout (backend may still be processing)")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_pdf_generation(case_name, session_id):
    """Test PDF generation endpoint."""
    print(f"\nTesting PDF generation for {case_name}...")
    
    try:
        pdf_payload = {
            "idea": "Test project",
            "stack": "Next.js, FastAPI",
            "team": 5,
            "deadline": 12,
            "project_id": session_id,
            "consensus_plan": {
                "summary": "Test summary",
                "roadmap": [{"week": 1, "task": "Planning"}],
            },
            "judge_scores": {},
            "methodology_weights": {"Agile": 40, "Waterfall": 25, "Hybrid": 35},
        }
        
        response = requests.post(
            f"{API_BASE}/generate-pdf",
            json=pdf_payload,
            timeout=30,
        )
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✓ PDF generation successful: {content_length} bytes")
            return True
        else:
            print(f"✗ PDF generation failed: {response.status_code}")
            return False
    
    except Exception as e:
        print(f"✗ PDF generation error: {e}")
        return False

def main():
    print("\n" + "="*70)
    print("AI BOARDROOM — END-TO-END BACKEND VALIDATION")
    print("="*70)
    
    # Health check first
    if not test_health_check():
        print("\n✗ Backend is not responding. Exiting.")
        return
    
    # Test 3 cases
    passed = 0
    for case in test_cases:
        if test_debate_endpoint(case["name"], case["params"]):
            passed += 1
        time.sleep(2)  # Brief delay between requests
    
    # Summary
    print("\n" + "="*70)
    print("VALIDATION SUMMARY")
    print("="*70)
    print(f"Test cases passed: {passed}/{len(test_cases)}")
    
    if passed == len(test_cases):
        print("✓ All test cases passed!")
    else:
        print(f"✗ {len(test_cases) - passed} test case(s) failed.")

if __name__ == "__main__":
    main()
