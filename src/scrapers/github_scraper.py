"""
Scraper to fetch 2026 internships from GitHub and enrich with AI
"""

import requests
import json
import os
from dotenv import load_dotenv
import cohere
from datetime import datetime
import time
import re

load_dotenv()

# Global configuration - change this to scrape more/fewer internships
MAX_INTERNSHIPS = 5

def scrape_github_internships(max_internships=None):
    """Scrape internships from the GitHub README"""
    
    if max_internships is None:
        max_internships = MAX_INTERNSHIPS
    
    url = "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md"
    
    print("Fetching internships from GitHub...")
    response = requests.get(url)
    content = response.text
    
    internships = []
    
    # Find the table section (after "<!-- TABLE_START -->" and before "<!-- TABLE_END -->")
    table_start = content.find("<!-- TABLE_START -->")
    table_end = content.find("<!-- TABLE_END -->")
    
    if table_start == -1 or table_end == -1:
        print("Could not find internship table markers")
        return internships
    
    table_content = content[table_start:table_end]
    
    # Parse markdown table rows
    lines = table_content.split('\n')
    
    count = 0
    for line in lines:
        # Skip header, separator, and empty lines
        if '|---|' in line or '| Company |' in line or not line.strip() or '<!-- TABLE' in line:
            continue
        
        if not line.strip().startswith('|'):
            continue
        
        # Parse table row - cells are: [empty, company, position, location, posting, age, empty]
        cells = [cell.strip() for cell in line.split('|')]
        if len(cells) < 7:  # Need 7 cells
            continue
        
        # Extract company name from HTML strong tag in cell[1]
        company_match = re.search(r'<strong>(.+?)</strong>', cells[1])
        company = company_match.group(1) if company_match else cells[1]
        
        # Extract position from cell[2]
        position = cells[2].strip()
        
        # Extract location from cell[3]
        location = cells[3].strip()
        
        # Extract apply link from markdown in cell[4] (Posting column)
        link_match = re.search(r'href="(.+?)"', cells[4])
        apply_link = link_match.group(1) if link_match else ""
        
        if company and position and company != 'Company':
            internships.append({
                "company": company,
                "name": position,
                "location": location,
                "apply_link": apply_link
            })
            count += 1
            if count >= max_internships:
                break
    
    print(f"Scraped {len(internships)} internships")
    return internships

def enrich_with_ai(internships, co):
    """Use Cohere to enrich internship data with skills, requirements, etc."""
    
    prompt = f"""Given these internships posting:
{internships}


Generate a JSON array of objects with the following fields:
- skills: array of 3-6 relevant technical skills for this role
- degree: degree requirement (e.g., "Bachelor's in Computer Science or related field")
- field: array of 1-3 relevant fields of study
- experience: array of 1-3 experience requirements
- summary: 50-70 word summary of what this internship likely involves
- country: country name in lowercase with hyphens (e.g., "united-states")
- city: state or city in lowercase (e.g., "california", "new-york")

Return ONLY the JSON array of objects, no other text."""

    try:
        response = co.chat(
            model='command-a-03-2025',
            message=prompt,
            max_tokens=1000,
            temperature=0.3,
        )
        
        # Clean response
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
        # Return default values for all internships
        return [
            {
                "skills": ["Python", "Software Development"],
                "degree": "Bachelor's degree in Computer Science or related field",
                "field": ["Computer Science", "Software Engineering"],
                "experience": ["Programming experience"],
                "summary": f"Software engineering internship at {internship['company']} working on technical projects.",
                "country": "united-states",
                "city": "remote"
            }
            for internship in internships
        ]

def main():
    # Initialize Cohere
    cohere_api_key = os.getenv("COHERE_API_KEY")
    co = cohere.Client(cohere_api_key)
    
    # Scrape internships
    raw_internships = scrape_github_internships()
    
    if not raw_internships:
        print("No internships found. Exiting.")
        return
    
    # Enrich with AI
    enriched_internships = []
    
    print("\nEnriching internships with AI...")
    enriched_data = enrich_with_ai(raw_internships, co)
    
    # Merge raw internship data with enriched AI data
    for i, internship in enumerate(raw_internships):
        enriched = enriched_data[i] if i < len(enriched_data) else {}
        
        # Combine data
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
    
    # Save to file
    output_file = "data/internships_dataset_2026.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_internships, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Successfully scraped and enriched {len(enriched_internships)} internships")
    print(f"✓ Saved to {output_file}")
    print("\nNext steps:")
    print("1. Review the data in data/internships_dataset_2026.json")
    print("2. If satisfied, replace data/internships_dataset.json with this file")
    print("3. Run 'python scripts/setup_database.py' to update the database")
    
    return enriched_internships

if __name__ == "__main__":
    main()
