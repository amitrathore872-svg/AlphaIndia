import pandas as pd
from sqlalchemy.orm import Session

from app.db.database import Base, SessionLocal, engine
from app.models.company import Company

Base.metadata.create_all(bind=engine)

CSV_PATH = "data/nse_companies.csv"


def import_companies():
    df = pd.read_csv(CSV_PATH)

    db: Session = SessionLocal()

    inserted = 0
    skipped = 0

    for _, row in df.iterrows():

        exists = db.query(Company).filter(
            Company.symbol == row["Symbol"]
        ).first()

        if exists:
            skipped += 1
            continue

        company = Company(
            symbol=row["Symbol"],
            company=row["Company"],
            sector=row["Sector"],
        )

        db.add(company)
        inserted += 1

    db.commit()
    db.close()

    print(f"Inserted: {inserted}")
    print(f"Skipped : {skipped}")


if __name__ == "__main__":
    import_companies()