"""
Scraper to fetch internships from Internshala
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import re
from dotenv import load_dotenv
import cohere
from datetime import datetime
import time

load_dotenv()

# Global configuration - change this to scrape more/fewer internships
MAX_INTERNSHIPS = 50

def parse_stipend(stipend_text: str) -> dict:
    """
    Parse a stipend string like '₹ 12,000 /month' or 'Unpaid' into
    a structured dict compatible with the pipeline normalizer.
    """
    if not stipend_text:
        return {"type": "unpaid", "amount": None, "currency": "INR", "period": None}

    text = stipend_text.strip()

    if re.search(r'unpaid|volunteer|no stipend', text, re.IGNORECASE):
        return {"type": "unpaid", "amount": None, "currency": "INR", "period": None}

    if re.search(r'performance|incentive', text, re.IGNORECASE):
        return {"type": "performance-based", "amount": None, "currency": "INR", "period": None}

    # Detect currency
    currency = "INR"
    if "$" in text or "USD" in text:
        currency = "USD"
    elif "£" in text or "GBP" in text:
        currency = "GBP"
    elif "€" in text or "EUR" in text:
        currency = "EUR"

    # Extract numeric amount — handles ranges like "10,001 - 11,002" (take lower bound)
    clean = text.replace(',', '')
    amount_match = re.search(r'(\d+)', clean)
    amount = int(amount_match.group(1)) if amount_match else None

    # Detect period
    period = None
    if re.search(r'/month|per month|monthly', text, re.IGNORECASE):
        period = "monthly"
    elif re.search(r'/week|per week|weekly', text, re.IGNORECASE):
        period = "weekly"
    elif re.search(r'/day|per day|daily', text, re.IGNORECASE):
        period = "daily"
    elif re.search(r'lump.?sum|one.?time|total', text, re.IGNORECASE):
        period = "lump-sum"

    return {
        "type": "paid" if amount else "unpaid",
        "amount": amount,
        "currency": currency,
        "period": period,
    }


def scrape_internshala_internships(max_internships=None):
    """Scrape internships from Internshala"""

    if max_internships is None:
        max_internships = MAX_INTERNSHIPS

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    url = "https://internshala.com/internships/software-development-internship/"

    print(f"Fetching internships from Internshala...")

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        internships = []

        # Each internship is a div.individual_internship with an internshipid attribute
        internship_cards = soup.find_all('div', class_='individual_internship')

        print(f"Found {len(internship_cards)} internship cards")

        for card in internship_cards[:max_internships]:
            try:
                internship_id = card.get('internshipid', '')

                # --- Title & apply link ---
                # Listing page: a.job-title-href inside h2.job-internship-name
                title_elem = card.find('a', class_='job-title-href')
                if title_elem:
                    position = title_elem.text.strip()
                    href = title_elem.get('href', '') or card.get('data-href', '')
                else:
                    position = "Software Internship"
                    href = card.get('data-href', '')

                apply_link = ("https://internshala.com" + href) if href else "https://internshala.com"

                # --- Company name ---
                # Listing page: p.company-name
                company_elem = card.find('p', class_='company-name')
                company = company_elem.text.strip() if company_elem else "Unknown Company"

                # --- Location & Duration ---
                # Listing page: div.detail-row-1 > div.row-1-item (1=location, 2=stipend, 3=duration)
                row_items = card.find_all('div', class_='row-1-item')

                location_text = "Remote"
                for item in row_items:
                    if 'locations' in item.get('class', []):
                        location_text = item.get_text(separator=' ', strip=True)
                        break

                is_remote = bool(re.search(r'work from home|remote|wfh', location_text, re.IGNORECASE))

                # --- Stipend ---
                stipend_elem = card.find('span', class_='stipend')
                stipend_text = stipend_elem.text.strip() if stipend_elem else ""
                stipend = parse_stipend(stipend_text)

                # --- Duration ---
                # 3rd row-1-item span (after location and stipend items)
                duration_text = ""
                non_location_items = [i for i in row_items if 'locations' not in i.get('class', [])]
                for item in non_location_items:
                    span = item.find('span')
                    if span and not span.get('class'):  # plain span = duration (stipend has class)
                        duration_text = span.text.strip()
                        break

                # --- Skills ---
                # Skills are NOT on listing cards — fetched from detail page below
                skills = []

                # --- Deadline ---
                deadline_text = ""

                # --- Fetch detail page for additional fields ---
                # Listing card has limited info; detail page has city, duration, deadline, skills, perks, etc.
                card_skills = [s.text.strip() for s in card.find_all('div', class_='job_skill') if s.text.strip()]
                skills = card_skills
                perks = []
                openings = None
                responsibilities = ""
                about_company = ""
                company_website = ""

                if apply_link and apply_link != "https://internshala.com":
                    try:
                        time.sleep(0.5)  # be polite
                        detail_resp = requests.get(apply_link, headers=headers, timeout=10)
                        detail_soup = BeautifulSoup(detail_resp.content, 'html.parser')

                        # IMPORTANT: Only look in the main internship container, not similar/recommended internships
                        main_container = detail_soup.find('div', class_='detail_view') or detail_soup.find('div', class_='internship_details') or detail_soup

                        # --- City (overrides listing location if present) ---
                        detail_location = main_container.find('div', id='location_names')
                        if detail_location:
                            loc_link = detail_location.find('a')
                            if loc_link:
                                location_text = loc_link.text.strip()

                        # --- Duration (overrides listing duration) ---
                        detail_items = main_container.find_all('div', class_='other_detail_item')
                        duration_found = False
                        for item in detail_items:
                            heading = item.find('span')
                            if not heading:
                                continue
                            heading_text = heading.text.lower()

                            if 'duration' in heading_text and not duration_found:
                                body = item.find('div', class_='item_body')
                                if body:
                                    duration_text = body.text.strip()
                                    duration_found = True
                                    print(f"    Found duration in detail page: {duration_text}")

                            elif 'apply by' in heading_text:
                                body = item.find('div', class_='item_body')
                                if body:
                                    deadline_text = body.text.strip()

                            elif 'stipend' in heading_text:
                                # Re-parse stipend from detail page (more reliable)
                                stip_span = item.find('span', class_='stipend')
                                if stip_span:
                                    stipend_text = stip_span.text.strip()
                                    stipend = parse_stipend(stipend_text)

                        # --- Skills ---
                        skills_heading = main_container.find('h3', class_='skills_heading')
                        if skills_heading:
                            skills_container = skills_heading.find_next_sibling('div', class_='round_tabs_container')
                            if skills_container:
                                skills = [s.text.strip() for s in skills_container.find_all('span', class_='round_tabs') if s.text.strip()]

                        # --- Perks ---
                        perks_heading = main_container.find('h3', class_='perks_heading')
                        if perks_heading:
                            perks_container = perks_heading.find_next_sibling('div', class_='round_tabs_container')
                            if perks_container:
                                perks = [p.text.strip() for p in perks_container.find_all('span', class_='round_tabs') if p.text.strip()]

                        # --- Number of openings ---
                        openings_heading = main_container.find('h3', string=lambda t: t and 'number of openings' in t.lower())
                        if openings_heading:
                            openings_div = openings_heading.find_next_sibling('div', class_='text-container')
                            if openings_div:
                                try:
                                    openings = int(openings_div.text.strip())
                                except:
                                    pass

                        # --- Responsibilities (job description) ---
                        about_heading = main_container.find('h2', class_='about_heading')
                        if about_heading:
                            desc_div = about_heading.find_next_sibling('div', class_='text-container')
                            if desc_div:
                                # Split into array of responsibilities (by line breaks or bullet points)
                                text = desc_div.get_text(separator='\n', strip=True)
                                # Split by newlines and filter out empty lines
                                responsibilities = [line.strip() for line in text.split('\n') if line.strip()]

                        # --- Company info ---
                        company_heading = main_container.find('h2', string=lambda t: t and 'about' in t.lower() and company.lower() in t.lower())
                        if company_heading:
                            website_div = company_heading.find_next_sibling('div', class_='website_link')
                            if website_div:
                                link = website_div.find('a')
                                if link:
                                    company_website = link.get('href', '').strip()

                            about_div = company_heading.find_next_sibling('div', class_='about_company_text_container')
                            if about_div:
                                about_company = about_div.text.strip()

                        if not skills:
                            skills = card_skills
                        print(f"  Parsed '{position}': city={location_text}, duration={duration_text}, skills={len(skills)}, perks={len(perks)}")

                    except Exception as e:
                        print(f"  Could not fetch detail page for '{position}': {e}")

                internships.append({
                    "internship_id": internship_id,
                    "company": company,
                    "name": position,
                    "location": location_text,
                    "is_remote": is_remote,
                    "apply_link": apply_link,
                    "stipend_text": stipend_text,
                    "stipend": stipend,
                    "duration_string": duration_text,
                    "skills": skills,
                    "deadline_text": deadline_text,
                    "perks": perks,
                    "openings": openings,
                    "responsibilities": responsibilities,
                    "about_company": about_company,
                    "company_website": company_website,
                    "source": "web_scraping",
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
    """Use Cohere to enrich internship data with fields not available in the HTML"""

    prompt = f"""Given these internship postings:
{json.dumps(internships, indent=2)}

Generate a JSON array of objects (one per internship, in the same order) with these fields:
- degree: array of degree requirements (e.g. ["Bachelor's in Computer Science or related field"])
- field: array of 1-3 relevant fields of study (e.g. ["Computer Science", "Software Engineering"])
- summary: 50-70 word summary of what this internship involves (use the responsibilities field if available)
- country: country name in lowercase (default "india" if location is an Indian city)
- city: city name(s) in lowercase, comma-separated if multiple (e.g. "mumbai, delhi", "navi mumbai", "remote" for work from home)

Return ONLY the JSON array, no other text."""

    try:
        response = co.chat(
            model='command-a-03-2025',
            message=prompt,
            max_tokens=1500,
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

        if isinstance(enriched_data, dict):
            enriched_data = [enriched_data]

        return enriched_data

    except Exception as e:
        print(f"Error enriching internships: {e}")
        return [
            {
                "degree": ["Bachelor's degree in Computer Science or related field"],
                "field": ["Computer Science", "Software Engineering"],
                "summary": (
                    " ".join(internship.get("responsibilities", []))[:200] 
                    if isinstance(internship.get("responsibilities"), list) 
                    else f"Software engineering internship at {internship['company']}."
                ),
                "country": "india",
                "city": internship.get("location", "remote").lower().replace(" ", "-") if internship.get("location") else "remote",
            }
            for internship in internships
        ]


def main():
    cohere_api_key = os.getenv("COHERE_API_KEY")
    co = cohere.Client(cohere_api_key)

    raw_internships = scrape_internshala_internships()

    print("Raw internships:")
    print(json.dumps(raw_internships, indent=2))

    if not raw_internships:
        print("No internships found from Internshala.")
        return []

    print("\nEnriching internships with AI...")
    enriched_data = enrich_with_ai(raw_internships, co)

    enriched_internships = []

    for i, internship in enumerate(raw_internships):
        enriched = enriched_data[i] if i < len(enriched_data) else {}

        # Parse deadline_text to Date if present (e.g. "28 May' 26" -> 2026-05-28)
        deadline_date = None
        if internship.get("deadline_text"):
            try:
                # Parse formats like "28 May' 26" or "3 Jun' 26"
                deadline_str = internship["deadline_text"]
                # Replace ' with space and parse
                deadline_str = deadline_str.replace("'", " ")
                deadline_date = datetime.strptime(deadline_str, "%d %b %y").isoformat()
            except:
                pass

        # Ensure summary is a string
        summary = enriched.get("summary", "")
        if not isinstance(summary, str):
            # If AI returned something weird, generate from responsibilities
            if isinstance(internship.get("responsibilities"), list):
                summary = " ".join(internship["responsibilities"][:3])[:150]
            else:
                summary = f"Software engineering internship at {internship['company']}."

        # Extract city from location, handling multi-word cities and multiple cities
        city = enriched.get("city", "")
        if not city or not isinstance(city, str):
            # Fallback: use location field
            location = internship.get("location", "remote").lower()
            # Handle "work from home" -> "remote"
            if "work from home" in location or "wfh" in location or "remote" in location:
                city = "remote"
            elif "," in location:
                # Multiple cities: keep all, clean up spacing (e.g. "Mumbai, Delhi" -> "mumbai, delhi")
                cities = [c.strip() for c in location.split(",")]
                city = ", ".join(cities)
            else:
                # Keep full city name (e.g. "navi mumbai" not just "navi")
                city = location.strip()

        final_internship = {
            "name": internship["name"],
            "company": internship["company"],
            "apply_link": internship.get("apply_link", ""),
            "date_published": datetime.now().isoformat(),
            "deadline_date": deadline_date,
            "country": enriched.get("country", "india"),
            "city": city,
            "state": None,  # Not available in Internshala HTML
            "is_remote": internship.get("is_remote", False),
            "skills": internship.get("skills", []),
            "degree": enriched.get("degree", []),
            "field": enriched.get("field", []),
            "summary": summary,
            "responsibilities": internship.get("responsibilities"),  # Now an array
            "perks": internship.get("perks"),
            "openings": internship.get("openings"),
            "stipend": internship.get("stipend", {"type": "unpaid", "amount": None, "currency": "INR", "period": None}),
            "duration_string": internship.get("duration_string", ""),  # Pipeline normalizer will parse this
            "source": "web_scraping",
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
