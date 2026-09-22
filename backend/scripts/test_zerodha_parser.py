import csv
import io
import re

user_csv = '''"Instrument","Qty.","Avg. cost","LTP","Invested","Cur. val","P&L","Net chg.","Day chg.",""
"AEGISLOG",5,945,1417.25,4725,7086.25,2361.25,49.97,4.79,""
"AEROENTER",60,120.75,125.49,7245,7529.4,284.4,3.93,2.07,""
"ASTRAMICRO",18,1711.38,1631.2,30804.8,29361.6,-1443.2,-4.68,1.46,""
"ATHERENERG",26,991.77,1640,25785.9,42640,16854.1,65.36,5.81,""
"BETA",12,2195,2055.2,26340,24662.4,-1677.6,-6.37,-1.9,""
"BHARATFORG",1,1970.7,1976,1970.7,1976,5.3,0.27,2.97,""
"BUILDPRO",15,1307.82,1272.05,19617.3,19080.75,-536.55,-2.74,2.26,""
"CARTRADE",13,2671.09,2993.5,34724.2,38915.5,4191.3,12.07,1.85,""
"E2E",35,478.01,608.95,16730.5,21313.25,4582.75,27.39,0.74,""
"FCL",400,39.17,57.02,15668,22808,7140,45.57,7.61,""
"JSLL",1,600.15,510.4,600.15,510.4,-89.75,-14.95,4,""
"PHOENIXLTD",13,2042.1,1877.9,26547.3,24412.7,-2134.6,-8.04,0.3,""
"PICCADIL",87,720.01,589.4,62640.65,51277.8,-11362.85,-18.14,-1.86,""
"STYLAMIND",4,2700,3295.5,10800,13182,2382,22.06,1.77,""
"SUDEEPPHRM",20,1094.2,1155,21884,23100,1216,5.56,4.49,""
"WAAREEENER",1,3075,2560.7,3075,2560.7,-514.3,-16.73,3.55,""
"WINDLAS",23,1162.48,1109.45,26737.15,25517.35,-1219.8,-4.56,-0.73,""'''

reader = csv.DictReader(io.StringIO(user_csv))

def norm_key(k):
    return re.sub(r'[^a-z0-9]', '', k.strip().lower()) if k else ''

parsed_rows = []
for row in reader:
    cleaned = {norm_key(k): (v.strip() if v else "") for k, v in row.items() if k}
    
    # 1. Symbol
    symbol = None
    for k in ["instrument", "symbol", "stock", "tradingsymbol", "ticker", "scrip"]:
        if k in cleaned and cleaned[k]:
            symbol = cleaned[k].upper().replace(".NS", "").replace(".BO", "")
            break
            
    # 2. Qty
    qty = 0.0
    for k in ["qty", "quantity", "shares", "availableqty", "netqty", "units"]:
        if k in cleaned and cleaned[k]:
            try:
                qty = float(cleaned[k].replace(",", ""))
                break
            except ValueError:
                pass
                
    # 3. Avg Cost
    price = 0.0
    for k in ["avgcost", "avgcostprice", "buyprice", "avgprice", "price", "avgbuyprice", "costprice"]:
        if k in cleaned and cleaned[k]:
            try:
                price = float(cleaned[k].replace(",", "").replace("₹", ""))
                break
            except ValueError:
                pass
                
    # 4. LTP
    ltp = 0.0
    for k in ["ltp", "cmp", "lastprice", "curval", "currentprice"]:
        if k in cleaned and cleaned[k]:
            try:
                ltp = float(cleaned[k].replace(",", "").replace("₹", ""))
                break
            except ValueError:
                pass

    parsed_rows.append({"symbol": symbol, "qty": qty, "price": price, "ltp": ltp})

print(f"Total parsed rows: {len(parsed_rows)}")
for r in parsed_rows:
    print(f"Symbol: {r['symbol']:12} | Qty: {r['qty']:5} | Avg Price: {r['price']:8.2f} | LTP: {r['ltp']:8.2f}")
