# Data Load Instructions - Object Storage Method

## Step 1: Get Your Information Ready

After your CSV files finish uploading to the bucket, collect this information:

### A. Find Your Object Storage URLs

1. Go to your bucket in Oracle Cloud Console
2. Click on each file and copy the **URL Path (URI)**
3. They will look like this:

```
https://objectstorage.[REGION].oraclecloud.com/n/[NAMESPACE]/b/[BUCKET_NAME]/o/CONCEPT.csv
https://objectstorage.[REGION].oraclecloud.com/n/[NAMESPACE]/b/[BUCKET_NAME]/o/CONCEPT_RELATIONSHIP.csv
https://objectstorage.[REGION].oraclecloud.com/n/[NAMESPACE]/b/[BUCKET_NAME]/o/CONCEPT_ANCESTOR.csv
```

**Save these URLs - you'll need them!**

### B. Get Your Oracle Cloud Username

Your username is usually in one of these formats:
- `oracleidentitycloudservice/your.email@company.com`
- `your.email@company.com`
- A username you created

**Find it:** Cloud Console → Profile Icon → User Settings → Copy the username shown

### C. Get Your Auth Token

If you haven't created one yet:
1. Cloud Console → Profile Icon → User Settings
2. Scroll to **Auth Tokens** → Click **Generate Token**
3. Description: `OMOP Data Load`
4. Click **Generate** and **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

### D. Check if Your CSV Files Have Headers

Open `CONCEPT.csv` in a text editor and look at the first line:

- **Has header:** First line is `concept_id|concept_name|domain_id|...`
  → Use `'skipheaders' value '1'`

- **No header:** First line is actual data like `123456|Aspirin|Drug|...`
  → Use `'skipheaders' value '0'`

---

## Step 2: Edit the Load Script

Open: `C:\Users\T933261\mcsb_oracle\oracle_setup\load_from_object_storage.sql`

**Replace 4 things:**

1. **Line ~15:** Your Oracle Cloud username
2. **Line ~16:** Your auth token
3. **Lines ~33, 52, 71:** Your three Object Storage URLs
4. **Lines ~37, 56, 75:** Set skipheaders to '0' or '1' based on Step 1D above

---

## Step 3: Run the Script

1. Open **SQL Developer**
2. Connect to your Autonomous Database
3. Run the script:
   ```sql
   @C:\Users\T933261\mcsb_oracle\oracle_setup\load_from_object_storage.sql
   ```

**Expected time:** 10-20 minutes total for all 3 tables

---

## Step 4: Verify Success

The script will automatically show:
- Row counts for each table (should be millions)
- Any load errors (hopefully none!)

Expected row counts:
- CONCEPT: ~7-8 million
- CONCEPT_RELATIONSHIP: ~30-40 million
- CONCEPT_ANCESTOR: ~60-70 million

---

## What to Do Next

✅ **If load succeeds:** Run the index creation script
```sql
@C:\Users\T933261\mcsb_oracle\oracle_setup\03_create_indexes.sql
```

✅ **Then run validation tests:**
```sql
@C:\Users\T933261\mcsb_oracle\oracle_setup\04_test_queries.sql
```

✅ **After validation passes:** Let me know and we'll start building the React application!

---

## Troubleshooting

### Error: "ORA-20401: Authorization failed"
→ Check your username and auth token are correct

### Error: "ORA-20404: Object not found"
→ Check the Object Storage URL is correct and file uploaded successfully

### Error: "Invalid number format"
→ Check your CSV delimiter is pipe (`|`) not comma

### Load is very slow (>1 hour)
→ This is normal for multi-GB files. DBMS_CLOUD shows progress in DBA views.

---

## Clean Up After Success

Once data is loaded and validated, you can:
1. Delete CSV files from Object Storage bucket (to save costs)
2. Keep the bucket (empty) for future use
3. Or delete the entire bucket if you won't need it again
