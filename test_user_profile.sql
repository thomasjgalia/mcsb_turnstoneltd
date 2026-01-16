-- Test inserting and querying user profiles
-- Replace the UUID below with your actual Supabase user ID

-- Example: Insert a test user profile
-- Get your Supabase user ID from: Supabase Dashboard -> Authentication -> Users
-- Or from the frontend after logging in: user.id

DECLARE @test_user_id UNIQUEIDENTIFIER = NEWID(); -- Generates a random UUID for testing
DECLARE @test_email NVARCHAR(255) = 'test@veradigm.me';

-- Insert test user
INSERT INTO user_profiles (supabase_user_id, email, display_name)
VALUES (@test_user_id, @test_email, 'Test User');

-- Query the user profile we just created
SELECT * FROM user_profiles WHERE supabase_user_id = @test_user_id;

-- Query all user profiles
SELECT * FROM user_profiles;

-- Clean up test data (optional - uncomment to delete)
-- DELETE FROM user_profiles WHERE supabase_user_id = @test_user_id;
