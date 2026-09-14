# Alpha India Architecture Enforcement Rule

## Architecture Reference Rule
For any query regarding system architecture, database changes, background workers, or frontend screener extensions:
1. Refer to the architecture documentation package in [.agents/skills/alpha-india-architecture/](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/SKILL.md).
2. Follow the multi-engine pipeline structure:
   - Universe Management (`Company`)
   - Filing Registry (`FilingRegistry`)
   - Statement Warehouse (`QuarterlyResult`)
   - Ingestion Queue (`FinancialImportQueue`)
   - Audit & Backfill (`FinancialAuditEngine`)
   - Growth Calculation (`GrowthCalculatorService`)
3. Preserve established API structures for `/growth-screener`, `/mission-control`, and `/financials`.
