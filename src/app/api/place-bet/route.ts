import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded: any = jwt.decode(idToken.value)
    const userId = decoded?.sub

    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { courseCode, threshold, betAmount } = await request.json()

    if (!courseCode || !threshold || !betAmount) {
      return NextResponse.json({
        error: "Missing required fields: courseCode, threshold, betAmount"
      }, { status: 400 })
    }

    // Convert USD to ETH (assuming betAmount is in USD)
    // For testnet, let's use a simple conversion: $1 USD = 0.001 ETH
    // This makes betting affordable with your 0.05 ETH
    const usdAmount = parseFloat(betAmount)
    const ethAmount = usdAmount * 0.001 // Convert USD to ETH

    console.log(`Converting bet: $${usdAmount} USD → ${ethAmount} ETH`)

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")

    // Get user data
    const user = await users.findOne({ sub: userId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Find the course
    const courseIndex = user.courses?.findIndex((course: any) => course.code === courseCode)
    if (courseIndex === -1 || courseIndex === undefined) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const course = user.courses[courseIndex]

    // Find the odds index for this threshold
    const oddsIndex = course.odds?.findIndex((odd: any) => odd.threshold === threshold)
    if (oddsIndex === -1 || oddsIndex === undefined) {
      return NextResponse.json({ error: "Threshold not found in course odds" }, { status: 404 })
    }

    let contractAddress = course.contract

    // If no contract exists, deploy one
    if (!contractAddress) {
      console.log('No contract found for course, deploying new one...')

      try {
        const deployResponse = await fetch(`${process.env.BACKEND_SERVER_URL}/api/deploy-contract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': process.env.ADMIN_KEY || ''
          },
          body: JSON.stringify({
            courseCode,
            userId
          })
        })

        if (!deployResponse.ok) {
          throw new Error(`Deploy failed: ${deployResponse.statusText}`)
        }

        const deployResult = await deployResponse.json()
        contractAddress = deployResult.contract.address

        // Update course with contract address
        await users.updateOne(
          { sub: userId, "courses.code": courseCode },
          { $set: { "courses.$.contract": contractAddress } }
        )

        console.log('Contract deployed and saved:', contractAddress)
      } catch (error) {
        console.error('Contract deployment failed:', error)
        return NextResponse.json({
          error: "Failed to deploy contract",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 })
      }
    }

    // Place bet on the contract using ETH amount
    try {
      const betResponse = await fetch(`${process.env.BACKEND_SERVER_URL}/api/place-bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contractAddress,
          gradeThreshold: threshold,
          betAmount: ethAmount // Send ETH amount to smart contract
        })
      })

      if (!betResponse.ok) {
        throw new Error(`Bet placement failed: ${betResponse.statusText}`)
      }

      const betResult = await betResponse.json()

      // Use the actual bet ID returned from the smart contract
      const betId = betResult.betId ? parseInt(betResult.betId) : Date.now() // Fallback to timestamp if betId not available

      // Update user's bets array and course odds
      const updateOperations: any = {
        $push: {
          bets: {
            betId,
            courseCode,
            gradeThreshold: threshold,
            betAmount: usdAmount, // Store original USD amount in database
            betAmountETH: ethAmount, // Also store ETH amount for reference
            contractAddress,
            transactionHash: betResult.transactionHash,
            resolved: false,
            timestamp: new Date()
          }
        },
        $inc: {}
      }

      // Update shares for the specific odds
      const sharesPath = `courses.${courseIndex}.odds.${oddsIndex}.shares`
      updateOperations.$inc[sharesPath] = 1

      await users.updateOne(
        { sub: userId },
        updateOperations
      )

      return NextResponse.json({
        success: true,
        message: "Bet placed successfully",
        data: {
          betId,
          contractAddress,
          transactionHash: betResult.transactionHash,
          courseCode,
          threshold,
          betAmount: usdAmount,
          resolved: false,
          betAmountETH: ethAmount
        }
      })

    } catch (error) {
      console.error('Bet placement failed:', error)
      return NextResponse.json({
        error: "Failed to place bet",
        details: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Place bet API error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
