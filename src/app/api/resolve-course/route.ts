import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, courseCode, grade } = body;

    if (!email || !courseCode || grade === undefined || grade === null) {
      return NextResponse.json({ error: "Missing required fields: email, courseCode, grade" }, { status: 400 });
    }

    if (typeof grade !== 'number' || grade < 0 || grade > 100) {
      return NextResponse.json({ error: "Grade must be a number between 0 and 100" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");

    // Find the user first to get the contract address
    const user = await users.findOne({ email: email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the course to get the contract address
    const course = user.courses?.find((c: any) => c.code === courseCode);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const contractAddress = course.contract;

    // Update the course grade in the database and reset shares to 0
    const result = await users.updateOne(
      {
        email: email,
        "courses.code": courseCode
      },
      {
        $set: {
          "courses.$.grade": grade,
          "courses.$.past": true,
          "courses.$.odds.$[].shares": 0
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User or course not found" }, { status: 404 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: "Course was not updated" }, { status: 400 });
    }

    // If there's a contract address, resolve all related bets
    if (contractAddress && process.env.BACKEND_SERVER_URL && process.env.ADMIN_KEY) {
      try {
        // Call the new resolve-all-bets endpoint
        const response = await fetch(`${process.env.BACKEND_SERVER_URL}/api/admin/resolve-all-bets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': process.env.ADMIN_KEY
          },
          body: JSON.stringify({
            contractAddress: contractAddress,
            actualGrade: grade
          })
        });

        if (response.ok) {
          const resolutionResult = await response.json();
          console.log(`Successfully resolved all bets for course ${courseCode}:`, resolutionResult);

          // Update matching bets in MongoDB
          if (resolutionResult.resolvedBets && resolutionResult.resolvedBets.length > 0) {
            const betUpdates = [];

            for (const resolvedBet of resolutionResult.resolvedBets) {
              // Find the corresponding bet in MongoDB to get the original USD bet amount
              const userBetResult = await users.aggregate([
                {
                  $match: {
                    "bets": {
                      $elemMatch: {
                        "betId": resolvedBet.betId,
                        "contractAddress": contractAddress
                      }
                    }
                  }
                },
                {
                  $project: {
                    bet: {
                      $filter: {
                        input: "$bets",
                        cond: {
                          $and: [
                            { $eq: ["$$this.betId", resolvedBet.betId] },
                            { $eq: ["$$this.contractAddress", contractAddress] }
                          ]
                        }
                      }
                    }
                  }
                }
              ]).toArray();

              const betAmount = userBetResult?.[0]?.bet?.[0]?.betAmount || 0;
              const profit = resolvedBet.won ? 1.0 - betAmount : -betAmount;

              // Update the bet in the user's bets array
              const betUpdateResult = await users.updateOne(
                {
                  "bets.betId": resolvedBet.betId,
                  "bets.contractAddress": contractAddress
                },
                {
                  $set: {
                    "bets.$.resolved": true,
                    "bets.$.profit": profit,
                    "bets.$.won": resolvedBet.won
                  }
                }
              );

              betUpdates.push({
                betId: resolvedBet.betId,
                updated: betUpdateResult.modifiedCount > 0,
                profit: profit,
                won: resolvedBet.won
              });
            }

            console.log(`Updated ${betUpdates.filter(u => u.updated).length} bets in MongoDB`);
          }

          return NextResponse.json({
            success: true,
            message: "Course and all bets resolved successfully",
            contractResolutions: resolutionResult.resolvedBets || []
          });
        } else {
          const errorText = await response.text();
          console.error(`Failed to resolve bets for course ${courseCode}:`, errorText);

          return NextResponse.json({
            success: true,
            message: "Course resolved successfully, but some contract resolutions failed",
            contractError: errorText
          });
        }

      } catch (contractError) {
        console.error('Error resolving contract bets:', contractError);
        // Still return success for the database update, but log the contract error
        return NextResponse.json({
          success: true,
          message: "Course resolved successfully, but some contract resolutions failed",
          contractError: contractError instanceof Error ? contractError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({ success: true, message: "Course resolved successfully" });
  } catch (error) {
    console.error('Resolve course endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
