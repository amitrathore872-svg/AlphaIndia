from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Alpha India API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dashboard Health
@app.get("/")
def root():
    return {
        "project": "Alpha India",
        "status": "Running 🚀"
    }

@app.get("/health")
def health():
    return {"health": "OK"}

# Mock Quarterly Results (temporary)
@app.get("/results")
def quarterly_results():
    return [
        {
            "company": "Karnataka Bank",
            "sector": "Banking",
            "revenueGrowth": 24,
            "patGrowth": 31,
            "roce": 18.4,
            "marketCap": "₹14,300 Cr",
            "score": 92
        },
        {
            "company": "KPIT Technologies",
            "sector": "IT",
            "revenueGrowth": 30,
            "patGrowth": 34,
            "roce": 35.0,
            "marketCap": "₹41,000 Cr",
            "score": 97
        },
        {
            "company": "KEI Industries",
            "sector": "Electrical",
            "revenueGrowth": 28,
            "patGrowth": 40,
            "roce": 27.3,
            "marketCap": "₹36,500 Cr",
            "score": 95
        },
        {
            "company": "Deepak Nitrite",
            "sector": "Chemicals",
            "revenueGrowth": 22,
            "patGrowth": 26,
            "roce": 24.6,
            "marketCap": "₹29,000 Cr",
            "score": 89
        }
    ]