import json
from PyPDF2 import PdfReader
import os
from dotenv import load_dotenv
import cohere
import requests

# Load environment variables
load_dotenv()

def resume_into_json(resume):
    """Extract structured data from resume PDF using Cohere AI"""
    try:
        cohere_api_key = os.getenv("COHERE_API_KEY")
        if not cohere_api_key:
            raise ValueError("COHERE_API_KEY not found in environment variables")
        
        co = cohere.Client(cohere_api_key)

        # Extract text from PDF
        pdf_reader = PdfReader(resume)
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text()

        if not text.strip():
            raise ValueError("No text could be extracted from the PDF")

        prompt = f"""Extract structured information from this resume and return it as a JSON object.

Resume text:
{text}

Return a JSON object with these fields:
- Summary: brief professional summary
- Education: array of education entries with Institution, Degree, FieldOfStudy, StartDate, EndDate, Achievements
- Skills: array of technical skills
- Projects: array of projects with ProjectName, StartDate, EndDate, Responsibilities
- Experience: array of work experience with CompanyName, Role, Location, StartDate, EndDate, Responsibilities
- Activities: array of activities/extracurriculars
- Interests: array of interests
- AdditionalInformation: any other relevant info

IMPORTANT: Remove any personal information like name, email, phone number, or address.
Return ONLY the JSON object, no other text."""

        response = co.chat(
            model='command-a-03-2025',
            message=prompt,
            max_tokens=8000,
            temperature=0.2,
        )

        # Extract the response text properly from Cohere API
        response_text = response.text.strip()
        
        # Handle cases where the response might be wrapped in markdown code blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        parsed_json = json.loads(response_text)
        return parsed_json
        
    except Exception as e:
        print(f"Error in resume_into_json: {e}")
        raise

def company_url(company):

    if company == "Astranis":
        return "https://www.jeezai.com/companies/astranis-space-technologies"
    
    company = (company.lower()).replace(" ", "-")

    return f"https://www.jeezai.com/companies/{company}/"


def get_company_info(company):
    data = requests.post(
        "https://advanced-research-agents.onrender.com",
        json={
            "query": company,
        }
    )
    return data.json()
