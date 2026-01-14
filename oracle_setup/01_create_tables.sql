-- ============================================================================
-- OMOP CDM Tables Creation Script for Oracle Cloud Autonomous Database
-- ============================================================================
-- This script creates the three core OMOP vocabulary tables needed for the
-- Medical Code Set Builder application.
--
-- Tables: CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR
-- Source: OMOP CDM v5.4 specification
-- Database: Oracle 19c (Autonomous Database)
-- ============================================================================

-- Clean up existing tables (optional - comment out if you want to keep data)
-- DROP TABLE CONCEPT_ANCESTOR PURGE;
-- DROP TABLE CONCEPT_RELATIONSHIP PURGE;
-- DROP TABLE CONCEPT PURGE;

-- ============================================================================
-- CONCEPT Table
-- ============================================================================
-- Stores all medical concepts from various vocabularies (ICD10CM, SNOMED,
-- RxNorm, LOINC, CPT4, etc.)
-- Source file: CONCEPT.csv (~1 GB, pipe-delimited)
-- ============================================================================
CREATE TABLE CONCEPT (
    CONCEPT_ID          NUMBER(19)      NOT NULL,
    CONCEPT_NAME        VARCHAR2(255)   NOT NULL,
    DOMAIN_ID           VARCHAR2(20)    NOT NULL,
    VOCABULARY_ID       VARCHAR2(20)    NOT NULL,
    CONCEPT_CLASS_ID    VARCHAR2(20)    NOT NULL,
    STANDARD_CONCEPT    VARCHAR2(1)     NULL,
    CONCEPT_CODE        VARCHAR2(50)    NOT NULL,
    VALID_START_DATE    DATE            NOT NULL,
    VALID_END_DATE      DATE            NOT NULL,
    INVALID_REASON      VARCHAR2(1)     NULL,
    CONSTRAINT PK_CONCEPT PRIMARY KEY (CONCEPT_ID)
);

COMMENT ON TABLE CONCEPT IS 'Core OMOP vocabulary table containing all medical concepts';
COMMENT ON COLUMN CONCEPT.CONCEPT_ID IS 'Unique identifier for each concept';
COMMENT ON COLUMN CONCEPT.CONCEPT_NAME IS 'Full text name/description of the concept';
COMMENT ON COLUMN CONCEPT.DOMAIN_ID IS 'Domain classification (Condition, Drug, Procedure, etc.)';
COMMENT ON COLUMN CONCEPT.VOCABULARY_ID IS 'Source vocabulary (ICD10CM, SNOMED, RxNorm, etc.)';
COMMENT ON COLUMN CONCEPT.CONCEPT_CLASS_ID IS 'Concept type within vocabulary';
COMMENT ON COLUMN CONCEPT.STANDARD_CONCEPT IS 'S = Standard concept, C = Classification concept, NULL = non-standard';
COMMENT ON COLUMN CONCEPT.CONCEPT_CODE IS 'Original code from source vocabulary';

-- ============================================================================
-- CONCEPT_RELATIONSHIP Table
-- ============================================================================
-- Stores relationships between concepts (e.g., "Maps to" relationships for
-- converting non-standard codes to standard concepts)
-- Source file: CONCEPT_RELATIONSHIP.csv (~2 GB, pipe-delimited)
-- ============================================================================
CREATE TABLE CONCEPT_RELATIONSHIP (
    CONCEPT_ID_1        NUMBER(19)      NOT NULL,
    CONCEPT_ID_2        NUMBER(19)      NOT NULL,
    RELATIONSHIP_ID     VARCHAR2(20)    NOT NULL,
    VALID_START_DATE    DATE            NOT NULL,
    VALID_END_DATE      DATE            NOT NULL,
    INVALID_REASON      VARCHAR2(1)     NULL,
    CONSTRAINT PK_CONCEPT_RELATIONSHIP PRIMARY KEY (CONCEPT_ID_1, CONCEPT_ID_2, RELATIONSHIP_ID)
);

COMMENT ON TABLE CONCEPT_RELATIONSHIP IS 'Stores relationships between concepts';
COMMENT ON COLUMN CONCEPT_RELATIONSHIP.CONCEPT_ID_1 IS 'Source concept ID';
COMMENT ON COLUMN CONCEPT_RELATIONSHIP.CONCEPT_ID_2 IS 'Target concept ID';
COMMENT ON COLUMN CONCEPT_RELATIONSHIP.RELATIONSHIP_ID IS 'Type of relationship (e.g., Maps to, Subsumes)';

-- ============================================================================
-- CONCEPT_ANCESTOR Table
-- ============================================================================
-- Stores hierarchical relationships between concepts (parent-child trees)
-- Used for exploring concept hierarchies and building code sets
-- Source file: CONCEPT_ANCESTOR.csv (~2 GB, pipe-delimited)
-- ============================================================================
CREATE TABLE CONCEPT_ANCESTOR (
    ANCESTOR_CONCEPT_ID         NUMBER(19)  NOT NULL,
    DESCENDANT_CONCEPT_ID       NUMBER(19)  NOT NULL,
    MIN_LEVELS_OF_SEPARATION    NUMBER(10)  NOT NULL,
    MAX_LEVELS_OF_SEPARATION    NUMBER(10)  NOT NULL,
    CONSTRAINT PK_CONCEPT_ANCESTOR PRIMARY KEY (ANCESTOR_CONCEPT_ID, DESCENDANT_CONCEPT_ID)
);

COMMENT ON TABLE CONCEPT_ANCESTOR IS 'Hierarchical relationships between concepts';
COMMENT ON COLUMN CONCEPT_ANCESTOR.ANCESTOR_CONCEPT_ID IS 'Parent/ancestor concept ID';
COMMENT ON COLUMN CONCEPT_ANCESTOR.DESCENDANT_CONCEPT_ID IS 'Child/descendant concept ID';
COMMENT ON COLUMN CONCEPT_ANCESTOR.MIN_LEVELS_OF_SEPARATION IS 'Shortest path distance in hierarchy tree';
COMMENT ON COLUMN CONCEPT_ANCESTOR.MAX_LEVELS_OF_SEPARATION IS 'Longest path distance in hierarchy tree';

-- ============================================================================
-- Foreign Key Constraints (Optional - can improve data integrity)
-- ============================================================================
-- NOTE: Foreign keys are commented out to speed up data loading.
-- Uncomment AFTER data is loaded if you want referential integrity checks.

-- ALTER TABLE CONCEPT_RELATIONSHIP ADD CONSTRAINT FK_CR_CONCEPT_1
--     FOREIGN KEY (CONCEPT_ID_1) REFERENCES CONCEPT(CONCEPT_ID);

-- ALTER TABLE CONCEPT_RELATIONSHIP ADD CONSTRAINT FK_CR_CONCEPT_2
--     FOREIGN KEY (CONCEPT_ID_2) REFERENCES CONCEPT(CONCEPT_ID);

-- ALTER TABLE CONCEPT_ANCESTOR ADD CONSTRAINT FK_CA_ANCESTOR
--     FOREIGN KEY (ANCESTOR_CONCEPT_ID) REFERENCES CONCEPT(CONCEPT_ID);

-- ALTER TABLE CONCEPT_ANCESTOR ADD CONSTRAINT FK_CA_DESCENDANT
--     FOREIGN KEY (DESCENDANT_CONCEPT_ID) REFERENCES CONCEPT(CONCEPT_ID);

-- ============================================================================
-- Table Statistics
-- ============================================================================
-- Note: Statistics will be gathered automatically after data load
-- You can also manually gather stats after loading data:
--
-- EXEC DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT');
-- EXEC DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT_RELATIONSHIP');
-- EXEC DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT_ANCESTOR');
--
-- Oracle Autonomous Database handles statistics automatically, so this step
-- is optional. Statistics will be gathered during data import.

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these after data loading to verify table creation
SELECT 'CONCEPT' AS TABLE_NAME, COUNT(*) AS ROW_COUNT FROM CONCEPT
UNION ALL
SELECT 'CONCEPT_RELATIONSHIP', COUNT(*) FROM CONCEPT_RELATIONSHIP
UNION ALL
SELECT 'CONCEPT_ANCESTOR', COUNT(*) FROM CONCEPT_ANCESTOR;

-- Check table sizes
SELECT
    SEGMENT_NAME,
    ROUND(BYTES/1024/1024/1024, 2) AS SIZE_GB
FROM USER_SEGMENTS
WHERE SEGMENT_NAME IN ('CONCEPT', 'CONCEPT_RELATIONSHIP', 'CONCEPT_ANCESTOR')
ORDER BY BYTES DESC;
