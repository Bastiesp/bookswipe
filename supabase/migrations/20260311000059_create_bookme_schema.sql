/*
  # Create BookMe schema - Book exchange social platform

  1. New Tables
    - `profiles` - User profiles with bio and preferences
    - `books` - Books published by users for exchange
    - `book_images` - Images for each book
    - `matches` - Mutual matches between users (both liked each other)
    - `likes` - Tracking when users like books/users
    - `conversations` - Chat conversations between matched users
    - `messages` - Individual messages in conversations

  2. Tables Details
    
    profiles:
      - id (uuid, auth user id)
      - username (text, unique)
      - display_name (text)
      - bio (text)
      - avatar_url (text)
      - created_at (timestamp)

    books:
      - id (uuid, primary key)
      - user_id (uuid, fk to profiles)
      - title (text)
      - author (text)
      - description (text)
      - genre (text) - ficcion, literatura_clasica, autoayuda, etc
      - condition_rating (1-10 integer) - state/condition
      - importance_level (text) - bestseller, medium, low_influence
      - created_at (timestamp)

    book_images:
      - id (uuid, primary key)
      - book_id (uuid, fk to books)
      - image_url (text)
      - created_at (timestamp)

    matches:
      - id (uuid, primary key)
      - user1_id (uuid)
      - user2_id (uuid)
      - book1_id (uuid) - book from user1
      - book2_id (uuid) - book from user2
      - created_at (timestamp)

    likes:
      - id (uuid, primary key)
      - user_id (uuid) - who liked
      - target_user_id (uuid) - user who owns the book
      - book_id (uuid) - the book they liked
      - created_at (timestamp)

    conversations:
      - id (uuid, primary key)
      - match_id (uuid, fk to matches)
      - created_at (timestamp)

    messages:
      - id (uuid, primary key)
      - conversation_id (uuid, fk to conversations)
      - sender_id (uuid)
      - content (text)
      - created_at (timestamp)

  3. Security
    - Enable RLS on all tables
    - Users can only see public book listings
    - Users can only modify their own profiles and books
    - Matches only visible to matched users
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text NOT NULL,
  description text,
  genre text NOT NULL,
  condition_rating integer CHECK (condition_rating >= 1 AND condition_rating <= 10),
  importance_level text NOT NULL CHECK (importance_level IN ('bestseller', 'medium', 'low_influence')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Books are viewable by everyone"
  ON books FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own books"
  ON books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
  ON books FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
  ON books FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_genre ON books(genre);
CREATE INDEX idx_books_importance ON books(importance_level);

CREATE TABLE IF NOT EXISTS book_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE book_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Book images are viewable by everyone"
  ON book_images FOR SELECT
  USING (true);

CREATE POLICY "Users can insert images for their books"
  ON book_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM books
      WHERE books.id = book_images.book_id
      AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images for their books"
  ON book_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM books
      WHERE books.id = book_images.book_id
      AND books.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see likes on public books"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like books"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike books"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_target_user_id ON likes(target_user_id);
CREATE INDEX idx_likes_book_id ON likes(book_id);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book1_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  book2_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own matches"
  ON matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "System creates matches"
  ON matches FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_matches_user1 ON matches(user1_id);
CREATE INDEX idx_matches_user2 ON matches(user2_id);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see conversations for their matches"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = conversations.match_id
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "System creates conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      INNER JOIN matches ON conversations.match_id = matches.id
      WHERE conversations.id = messages.conversation_id
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      INNER JOIN matches ON conversations.match_id = matches.id
      WHERE conversations.id = messages.conversation_id
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);