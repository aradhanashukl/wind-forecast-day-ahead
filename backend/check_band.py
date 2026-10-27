from fastapi.testclient import TestClient
import main

client = TestClient(main.app)
inside = below = above = 0
for day in main.DAYS:
    body = client.get(f"/api/forecast/{day}").json()
    if body["band"] is None:
        continue
    for r in body["rows"]:
        if r["actual"] is None or r["low"] is None:
            continue
        if r["actual"] < r["low"]:
            below += 1
        elif r["actual"] > r["high"]:
            above += 1
        else:
            inside += 1
total = inside + below + above
print(f"hours checked: {total}")
print(f"actual inside the band: {inside / total:.0%}")
print(f"actual below the band:  {below / total:.0%}")
print(f"actual above the band:  {above / total:.0%}")