-- ============================================================================
-- Azure SQL: Create OMOP Tables
-- ============================================================================
-- Run this script in Azure Data Studio after connecting to your database
-- ============================================================================

-- Create CONCEPT table
CREATE TABLE concept (
  concept_id INT NOT NULL PRIMARY KEY,
  concept_name NVARCHAR(255) NOT NULL,
  domain_id NVARCHAR(20) NOT NULL,
  vocabulary_id NVARCHAR(20) NOT NULL,
  concept_class_id NVARCHAR(20) NOT NULL,
  standard_concept NVARCHAR(1) NULL,
  concept_code NVARCHAR(50) NOT NULL,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason NVARCHAR(1) NULL
);

-- Create CONCEPT_ANCESTOR table
CREATE TABLE concept_ancestor (
  ancestor_concept_id INT NOT NULL,
  descendant_concept_id INT NOT NULL,
  min_levels_of_separation INT NOT NULL,
  max_levels_of_separation INT NOT NULL,
  PRIMARY KEY (ancestor_concept_id, descendant_concept_id)
);

-- Create CONCEPT_RELATIONSHIP table
CREATE TABLE concept_relationship (
  concept_id_1 INT NOT NULL,
  concept_id_2 INT NOT NULL,
  relationship_id NVARCHAR(20) NOT NULL,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason NVARCHAR(1) NULL,
  PRIMARY KEY (concept_id_1, concept_id_2, relationship_id)
);

-- Create indexes for performance
CREATE INDEX idx_concept_domain ON concept(domain_id);
CREATE INDEX idx_concept_vocabulary ON concept(vocabulary_id);
CREATE INDEX idx_concept_class ON concept(concept_class_id);
CREATE INDEX idx_concept_code ON concept(concept_code);

CREATE INDEX idx_ancestor_descendant ON concept_ancestor(descendant_concept_id);
CREATE INDEX idx_ancestor_ancestor ON concept_ancestor(ancestor_concept_id);

CREATE INDEX idx_relationship_concept1 ON concept_relationship(concept_id_1);
CREATE INDEX idx_relationship_concept2 ON concept_relationship(concept_id_2);
CREATE INDEX idx_relationship_id ON concept_relationship(relationship_id);

PRINT 'Tables and indexes created successfully!';
