import urllib.request

def verify():
    url = "http://localhost:3000/vcp-discovery"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode("utf-8")
    
    checks = [
        "Scanner Engine:",
        "Scan Now (On-Demand)",
        "Live Monitoring Mode",
        "Incremental Cache",
        "Parallel Worker Pool Progress",
        "Signal Track Record",
        "Throughput",
        "Opportunities",
    ]
    
    print(f"Checking HTML from {url} ({len(html)} bytes):")
    for check in checks:
        found = check in html
        print(f"  [{'PASS' if found else 'FAIL'}] '{check}' -> {found}")

if __name__ == "__main__":
    verify()
