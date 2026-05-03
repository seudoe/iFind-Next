"""
Scraper to fetch internships from Indeed
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from dotenv import load_dotenv
import cohere
from datetime import datetime
import time
import urllib.parse

load_dotenv()

# Global configuration - change this to scrape more/fewer internships
MAX_INTERNSHIPS = 50

def scrape_indeed_internships(max_internships=None, location="United States"):
    """Scrape internships from Indeed"""
    
    if max_internships is None:
        max_internships = MAX_INTERNSHIPS
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    # Search for software engineering internships
    query = "software engineering intern"
    encoded_query = urllib.parse.quote(query)
    encoded_location = urllib.parse.quote(location)
    
    url = f"https://www.indeed.com/jobs?q={encoded_query}&l={encoded_location}&sort=date"
    
    print(f"Fetching internships from Indeed...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        internships = []
        
        # Find job cards - Indeed uses various class names
        job_cards = soup.find_all('div', class_='job_seen_beacon') or \
                   soup.find_all('div', class_='jobsearch-SerpJobCard') or \
                   soup.find_all('td', class_='resultContent')
        
        if not job_cards:
            # Try finding by data-jk attribute (job key)
            job_cards = soup.find_all('div', attrs={'data-jk': True})
        
        print(f"Found {len(job_cards)} job cards")
        
        for card in job_cards[:max_internships]:
            try:
                # Extract job title
                title_elem = card.find('h2', class_='jobTitle') or \
                            card.find('a', class_='jcs-JobTitle') or \
                            card.find('span', attrs={'title': True})
                
                if title_elem:
                    # Get the actual title text
                    title_span = title_elem.find('span', attrs={'title': True})
                    position = title_span['title'] if title_span else title_elem.text.strip()
                else:
                    position = "Software Engineering Intern"
                
                # Extract company name
                company_elem = card.find('span', class_='companyName') or \
                              card.find('span', attrs={'data-testid': 'company-name'})
                company = company_elem.text.strip() if company_elem else "Unknown Company"
                
                # Extract location
                location_elem = card.find('div', class_='companyLocation') or \
                               card.find('div', attrs={'data-testid': 'text-location'})
                job_location = location_elem.text.strip() if location_elem else location
                
                # Extract apply link
                link_elem = card.find('a', class_='jcs-JobTitle') or \
                           card.find('h2', class_='jobTitle')
                
                if link_elem:
                    if link_elem.name == 'a':
                        job_id = link_elem.get('data-jk') or link_elem.get('id', '').replace('job_', '')
                        href = link_elem.get('href', '')
                    else:
                        nested_link = link_elem.find('a')
                        if nested_link:
                            job_id = nested_link.get('data-jk') or nested_link.get('id', '').replace('job_', '')
                            href = nested_link.get('href', '')
                        else:
                            job_id = None
                            href = ''
                    
                    if href and href.startswith('/'):
                        apply_link = f"https://www.indeed.com{href}"
                    elif job_id:
                        apply_link = f"https://www.indeed.com/viewjob?jk={job_id}"
                    else:
                        apply_link = "https://www.indeed.com"
                else:
                    apply_link = "https://www.indeed.com"
                
                # Only add if it's actually an internship
                if 'intern' in position.lower():
                    internships.append({
                        "company": company,
                        "name": position,
                        "location": job_location,
                        "apply_link": apply_link,
                        "source": "Indeed"
                    })
                
            except Exception as e:
                print(f"Error parsing job card: {e}")
                continue
        
        print(f"Successfully scraped {len(internships)} internships from Indeed")
        return internships
        
    except Exception as e:
        print(f"Error scraping Indeed: {e}")
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
- country: country name in lowercase with hyphens (e.g., "united-states", "india")
- city: city/state in lowercase (e.g., "california", "new-york", "remote")

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
                "country": "united-states",
                "city": "remote"
            }
            for internship in internships
        ]

def main():
    cohere_api_key = os.getenv("COHERE_API_KEY")
    co = cohere.Client(cohere_api_key)
    
    raw_internships = scrape_indeed_internships()
    
    if not raw_internships:
        print("No internships found from Indeed.")
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
            "country": enriched.get("country", "united-states"),
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
    
    output_file = "data/internships_indeed.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_internships, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Scraped and enriched {len(enriched_internships)} internships from Indeed")
    print(f"✓ Saved to {output_file}")
    
    return enriched_internships

if __name__ == "__main__":
    main()
