import { Auth0Client } from '@auth0/nextjs-auth0/server';
import clientPromise from '@/lib/mongodb';
import { NextRequest } from 'next/server';

// Create Auth0 client instance
const auth0 = new Auth0Client();

const afterCallback = async (req: any, session: any) => {
  try {
    const client = await clientPromise;
    const db = client.db('dev');
    const users = db.collection('users');

    const { user } = session;

    await users.updateOne(
      { auth0Id: user.sub },
      {
        $set: {
          auth0Id: user.sub,
          email: user.email,
          name: user.name,
          picture: user.picture,
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error syncing user to MongoDB:', error);
  }

  return session;
};

// Use the auth0 client's middleware method
export async function GET(request: NextRequest) {
  return await auth0.middleware(request);
}

export async function POST(request: NextRequest) {
  return await auth0.middleware(request);
}
