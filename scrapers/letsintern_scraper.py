import requests
from bs4 import BeautifulSoup
import pandas as pd

URL = "https://letsintern.in/current-internships/"

def clean(x):
    return x.strip() if x else "Not specified"

def scrape_letsintern():
    jobs = []
    print(f"Fetching {URL}...")
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        response = requests.get(URL, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching LetsIntern: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    
    # New strategy based on inspection
    containers = soup.find_all("div", class_="elementor-icon-box-content")
    print(f"Found {len(containers)} job containers")

    for container in containers:
        try:
            title_tag = container.find("h3", class_="elementor-icon-box-title")
            if not title_tag:
                continue
                
            title = clean(title_tag.text)
            
            # The link is often in a "Click here" button nearby.
            # Let's look in the parent's siblings or follow the container.
            # Looking at the HTML structure, the link might be outside the div.
            # Let's try to find the next link with "Click here" text.
            link = ""
            # Search forward from this container
            current = container
            while current:
                link_tag = current.find_all("a")
                for l in link_tag:
                    if "Click here" in l.text or "letsintern.in" in l.get("href", ""):
                        link = l.get("href")
                        break
                if link: break
                current = current.find_next_sibling()
                # Don't search too far
                if not current or current.name == "div" and "elementor-icon-box-content" in current.get("class", []):
                    break

            if title and link and "current-internships" not in link:
                jobs.append({
                    "title": title,
                    "company": "LetsIntern",
                    "location": "Remote / India",
                    "salary": "Not specified",
                    "skills": "",
                    "link": link
                })

        except Exception as e:
            print(f"Error parsing job: {e}")
            continue

    return jobs


def save_csv(jobs):
    if not jobs:
        print("No jobs found for LetsIntern. Skipping CSV creation.")
        return
    df = pd.DataFrame(jobs)
    expected_cols = ["title", "company", "location", "salary", "skills", "link"]
    for col in expected_cols:
        if col not in df.columns:
            df[col] = "Not specified"
            
    df = df[expected_cols]
    df.to_csv("letsintern_internships.csv", index=False)
    print(f"Saved {len(df)} LetsIntern jobs to letsintern_internships.csv")


if __name__ == "__main__":
    data = scrape_letsintern()
    save_csv(data)