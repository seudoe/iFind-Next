"""Debug script to inspect Internshala HTML structure"""
import requests
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

url = "https://internshala.com/internships/software-development-internship/"
response = requests.get(url, headers=headers, timeout=15)
print(f"Status: {response.status_code}")

soup = BeautifulSoup(response.content, 'html.parser')

# Find first internship card and dump its HTML
cards = soup.find_all('div', class_='individual_internship')
print(f"\nFound {len(cards)} cards with class 'individual_internship'")

if cards:
    card = cards[0]
    print("\n--- First card HTML (truncated) ---")
    print(str(card)[:3000])
    print("\n--- All <a> tags in first card ---")
    for a in card.find_all('a'):
        print(f"  href={a.get('href')} class={a.get('class')} text={a.text.strip()[:50]}")
    print("\n--- All elements with 'title' or 'heading' in class ---")
    for el in card.find_all(class_=lambda c: c and ('title' in c or 'heading' in c or 'profile' in c)):
        print(f"  tag={el.name} class={el.get('class')} text={el.text.strip()[:80]}")
else:
    # Try other selectors
    print("\nTrying alternative selectors...")
    for cls in ['internship_meta', 'internship-listing', 'job-internship-card']:
        found = soup.find_all(class_=cls)
        print(f"  class='{cls}': {len(found)} found")
    
    # Dump a portion of the page to see structure
    print("\n--- Page body snippet ---")
    body = soup.find('body')
    if body:
        print(str(body)[:5000])
