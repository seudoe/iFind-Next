"""
Scraper to fetch internships from Internshala
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from dotenv import load_dotenv
import cohere
from datetime import datetime
import time

load_dotenv()

# Global configuration - change this to scrape more/fewer internships
MAX_INTERNSHIPS = 50

def scrape_internshala_internships(max_internships=None):
    """Scrape internships from Internshala"""
    
    if max_internships is None:
        max_internships = MAX_INTERNSHIPS
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Search for software engineering internships
    url = "https://internshala.com/internships/software-development-internship/"
    
    print(f"Fetching internships from Internshala...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        internships = []
        
        # Find internship cards
        internship_cards = soup.find_all('div', class_='individual_internship')
        
        if not internship_cards:
            # Try alternative class names
            internship_cards = soup.find_all('div', class_='internship_meta')
        
        print(f"Found {len(internship_cards)} internship cards")
        
        for card in internship_cards[:max_internships]:
            try:
                # Extract position title and apply link from the job title anchor
                title_elem = card.find('a', class_='job-title-href')
                position = title_elem.text.strip() if title_elem else "Software Internship"
                href = title_elem.get('href', '') if title_elem else ''
                apply_link = ("https://internshala.com" + href) if href else "https://internshala.com"

                # Extract company name
                company_elem = card.find('p', class_='company-name')
                company = company_elem.text.strip() if company_elem else "Unknown Company"

                # Extract location
                location_elem = card.find('div', class_='locations')
                location = location_elem.text.strip() if location_elem else "Remote"

                # Extract stipend
                stipend_elem = card.find('span', class_='stipend')
                stipend_text = stipend_elem.text.strip() if stipend_elem else ""

                # Extract duration (3rd row-1-item span)
                row_items = card.find_all('div', class_='row-1-item')
                duration_text = ""
                if len(row_items) >= 3:
                    duration_text = row_items[2].find('span').text.strip() if row_items[2].find('span') else ""

                internships.append({
                    "company": company,
                    "name": position,
                    "location": location,
                    "apply_link": apply_link,
                    "stipend_text": stipend_text,
                    "duration_text": duration_text,
                    "source": "Internshala"
                })
                
            except Exception as e:
                print(f"Error parsing internship card: {e}")
                continue
        
        print(f"Successfully scraped {len(internships)} internships from Internshala")
        return internships
        
    except Exception as e:
        print(f"Error scraping Internshala: {e}")
        return []

def enrich_with_ai(internships, co):
    """Use Cohere to enrich internship data"""
    
    prompt = f"""Given these internships posting:
{internships}


Generate a JSON array of objects with the following fields:
- skills: array of 3-6 relevant technical skills for this role
- degree: degree requirement (e.g., "Bachelor's in Computer Science or related field")
- field: array of 1-3 relevant fields of study
- experience: array of 1-3 experience requirements
- summary: 50-70 word summary of what this internship likely involves
- country: country name in lowercase with hyphens (e.g., "india", "united-states")
- city: city name in lowercase (e.g., "bangalore", "mumbai", "remote")

Return ONLY the JSON array of objects, no other text."""

    try:
        response = co.chat(
            model='command-a-03-2025',
            message=prompt,
            max_tokens=1000,
            temperature=0.3,
        )
        
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        enriched_data = json.loads(response_text)

        # Ensure we always return a list
        if isinstance(enriched_data, dict):
            enriched_data = [enriched_data]

        return enriched_data
        
    except Exception as e:
        print(f"Error enriching internships: {e}")
        return [
            {
                "skills": ["Python", "Software Development"],
                "degree": "Bachelor's degree in Computer Science or related field",
                "field": ["Computer Science", "Software Engineering"],
                "experience": ["Programming experience"],
                "summary": f"Software engineering internship at {internship['company']}.",
                "country": "india",
                "city": "remote"
            }
            for internship in internships
        ]



def main():
    cohere_api_key = os.getenv("COHERE_API_KEY")
    co = cohere.Client(cohere_api_key)
    
    raw_internships = scrape_internshala_internships()
    
    print("Raw internships : --------------------------------------------------------------")
    print(raw_internships)  ##  why is this not priting
    
    if not raw_internships:
        print("No internships found from Internshala.")
        return []
    
    enriched_internships = []
    
    print("\nEnriching internships with AI...")
    enriched_data = enrich_with_ai(raw_internships, co)
    
    # Merge raw internship data with enriched AI data
    for i, internship in enumerate(raw_internships):
        enriched = enriched_data[i] if i < len(enriched_data) else {}
        
        final_internship = {
            "name": internship["name"],
            "company": internship["company"],
            "apply_link": internship.get("apply_link", ""),
            "date_published": datetime.now().strftime("%a %b %d %Y 00:00:00 GMT+0000 (Coordinated Universal Time)"),
            "country": enriched.get("country", "india"),
            "city": enriched.get("city", "remote"),
            "location": internship.get("location", ""),
            "skills": enriched.get("skills", []),
            "degree": enriched.get("degree", ""),
            "field": enriched.get("field", []),
            "experience": enriched.get("experience", []),
            "summary": enriched.get("summary", "")
        }
        
        enriched_internships.append(final_internship)
    
    print(f"\nSuccessfully enriched {len(enriched_internships)} internships")


    output_file = "data/internships_internshala.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_internships, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Scraped and enriched {len(enriched_internships)} internships from Internshala")
    print(f"✓ Saved to {output_file}")
    
    return enriched_internships

if __name__ == "__main__":
    main()
