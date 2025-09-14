## Inspiration

Have you ever promised to yourself you would lock in only to end up procrastinating for hours? Many students feel unmotivated in the age of modern distractions, from doomscrolling to brainrot and even to digital gambling. ScholarMarket solves this problem by introducing a motivational betting platform to encourage students to invest greater efforts into their studies. Students can bet cryptocurrency on improving their academic performance to motivate them to work harder. It also provides an opportunity for universities to release "probabilistic scholarships" to students to who do well. By harnessing modern distractions and transforming them into monetary incentives to perform better, ScholarMarket helps build a more productive, competitive, and (hopefully) successful learning environment for students.

## What it does

ScholarMarket is essentially Polymarket for students to bet on their grades. The web backend uses a machine learning model to predict the odds of a student achieving a particular goal based on their performance trends. It then allows the student to bet a chosen value of Etherium and win a greater sum for reaching the goal based on these odds.

## How we built it

We trained a convolutional neural network using Pytorch to calculate the probability of a student getting a specific mark given their past performance. The model was trained on datasets of students' performance for different courses over time while factoring in a difficulty estimate for each course.

Our web app was implemented using NextJS, and we integrated blockchain functionality using Hardhat and Ethereum L2 smart contracts. The smart contract deployment allows users to place small bets on their grade predictions, with the potential to earn $1 per share if they achieve a grade above a certain point. We stored corresponding data for users in MongoDB to speed up bets by caching contract addresses and similar data.

## Challenges we ran into
For the ML model, we originally used a 1D convolutional layer to process the sequence of past grades. However, this model yields to a 40% accuracy, which indicates it cannot reflect the trends well. We did researches and found that we can actually use a LSTM model for this task. This model helped us to reach a eventual accuracy of 70%+.

## Accomplishments that we're proud of

We didn't have much experience with crypto and Ethereum before this hackathon, so we're glad we learned something new while integrating it into a cool project. We're particularly proud of implementing a working smart contract system that handles real value transactions while maintaining security and solvency protections.

## What we learned

We learned how to use smart contracts and the Ethereum development ecosystem from the ground up. This included learning Hardhat for the first time, understanding how to write and deploy smart contracts with Solidity, and figuring out how to connect blockchain functionality to a traditional web app. We discovered the differences between testnets and mainnet, learned about Layer 2 networks and why they're useful for reducing costs, and got hands-on experience with the entire Web3 development workflow.

## What's next for ScholarMarket

Our current machine learning model does not take into account different types of courses and their similarities or differences. It only uses the course difficulty and order in which they were taken to predict trends. However, for a more accurate prediction, the model could recognize that similar courses such as 1st and 2nd year calculus are more likely to affect each others' performance.