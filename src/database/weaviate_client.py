import weaviate
import json
import os
from dotenv import load_dotenv
from weaviate.classes.init import AdditionalConfig, Timeout, Auth
from weaviate.classes.config import Configure, Property, DataType

# Load environment variables
load_dotenv()

url = os.getenv("WEAVIATE_URL")
apikey = os.getenv("WEAVIATE_API_KEY")
cohere_api_key = os.getenv("COHERE_API_KEY")

# Connect to Weaviate using the new API
client = weaviate.connect_to_weaviate_cloud(
    cluster_url=url,
    auth_credentials=Auth.api_key(apikey),
    headers={
        "X-Cohere-Api-Key": cohere_api_key
    },
    additional_config=AdditionalConfig(
        timeout=Timeout(init=30, query=60, insert=120)
    )
)

try:
    # Check if collection exists
    if client.collections.exists("Internship"):
        print("Collection 'Internship' already exists. Deleting it...")
        client.collections.delete("Internship")
    
    # Create the Internship collection with proper v4.20+ API
    print("Creating 'Internship' collection...")
    client.collections.create(
        name="Internship",
        vector_config=[
            Configure.Vectors.text2vec_cohere(
                name="default",
                source_properties=["name", "company", "summary", "skills", "degree", "field", "experience"]
            )
        ],
        properties=[
            Property(name="name", data_type=DataType.TEXT),
            Property(name="company", data_type=DataType.TEXT),
            Property(name="apply_link", data_type=DataType.TEXT),
            Property(name="date_published", data_type=DataType.TEXT),
            Property(name="country", data_type=DataType.TEXT),
            Property(name="city", data_type=DataType.TEXT),
            Property(name="location", data_type=DataType.TEXT),
            Property(name="skills", data_type=DataType.TEXT_ARRAY),
            Property(name="degree", data_type=DataType.TEXT),
            Property(name="field", data_type=DataType.TEXT_ARRAY),
            Property(name="experience", data_type=DataType.TEXT_ARRAY),
            Property(name="summary", data_type=DataType.TEXT),
        ]
    )
    print("Collection created successfully!")
    
    # Load internship data
    print("Loading internship data...")
    with open('data/internships_dataset.json', 'r', encoding='utf-8') as f:
        internships = json.load(f)
    
    # Get the collection
    collection = client.collections.get("Internship")
    
    # Insert data in batches
    print(f"Inserting {len(internships)} internships...")
    with collection.batch.dynamic() as batch:
        for internship in internships:
            # Clean the data - ensure no None values for arrays and provide defaults
            # Convert strings to arrays where needed
            skills = internship.get("skills", [])
            if isinstance(skills, str):
                skills = [skills] if skills else []
            
            field = internship.get("field", [])
            if isinstance(field, str):
                field = [field] if field else []
            
            experience = internship.get("experience", [])
            if isinstance(experience, str):
                experience = [experience] if experience else []
            
            cleaned_internship = {
                "name": internship.get("name", ""),
                "company": internship.get("company", ""),
                "apply_link": internship.get("apply_link", ""),
                "date_published": internship.get("date_published", ""),
                "country": internship.get("country", ""),
                "city": internship.get("city", ""),
                "location": internship.get("location", ""),
                "skills": skills if skills else [],
                "degree": internship.get("degree", ""),
                "field": field if field else [],
                "experience": experience if experience else [],
                "summary": internship.get("summary", ""),
            }
            batch.add_object(properties=cleaned_internship)
    
    print(f"Successfully loaded {len(internships)} internships into Weaviate!")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
    print("Connection closed.")
