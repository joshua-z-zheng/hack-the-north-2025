// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GradePredictionMarket {
    address public admin;
    uint256 public constant PAYOUT_AMOUNT = 0.001 ether; // $1.00 payout (at $1 = 0.001 ETH conversion)

    struct Bet {
        address bettor;
        uint256 betAmount;
        uint256 gradeThreshold;
        uint256 potentialPayout;
        bool isResolved;
        bool won;
        uint256 timestamp;
    }

    // Mapping from bet ID to Bet
    mapping(uint256 => Bet) public bets;
    uint256 public nextBetId;

    // Track total liabilities
    uint256 public totalLiabilities;
    uint256 public contractBalance;

    // Events
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 amount,
        uint256 threshold,
        uint256 potentialPayout
    );
    event BetResolved(uint256 indexed betId, uint256 actualGrade, bool won);
    event PayoutSent(
        uint256 indexed betId,
        address indexed bettor,
        uint256 amount
    );
    event ContractFunded(uint256 amount);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    /**
     * @dev Fund the contract to ensure payouts can be made
     */
    function fundContract() external payable onlyAdmin {
        contractBalance += msg.value;
        emit ContractFunded(msg.value);
    }

    /**
     * @dev Place a bet that grade will be > 80
     */
    function placeBet(uint256 _gradeThreshold) external payable {
        require(
            _gradeThreshold > 0 && _gradeThreshold <= 100,
            "Invalid grade threshold"
        );
        require(
            contractBalance >= totalLiabilities + PAYOUT_AMOUNT,
            "Insufficient contract funds for payout"
        );

        uint256 betId = nextBetId++;

        bets[betId] = Bet({
            bettor: msg.sender,
            betAmount: msg.value,
            gradeThreshold: _gradeThreshold,
            potentialPayout: PAYOUT_AMOUNT,
            isResolved: false,
            won: false,
            timestamp: block.timestamp
        });

        totalLiabilities += PAYOUT_AMOUNT;
        contractBalance += msg.value;

        emit BetPlaced(
            betId,
            msg.sender,
            msg.value,
            _gradeThreshold,
            PAYOUT_AMOUNT
        );
    }

    /**
     * @dev Admin resolves a bet with the actual grade
     * @param betId The ID of the bet to resolve
     * @param actualGrade The actual grade achieved (0-100)
     */
    function resolveBet(uint256 betId, uint256 actualGrade) external onlyAdmin {
        require(betId < nextBetId, "Invalid bet ID");
        require(!bets[betId].isResolved, "Bet already resolved");
        require(actualGrade <= 100, "Invalid grade");

        Bet storage bet = bets[betId];
        bet.isResolved = true;

        // Check if the bet won (grade > threshold)
        if (actualGrade > bet.gradeThreshold) {
            bet.won = true;

            // Send payout
            (bool success, ) = bet.bettor.call{value: bet.potentialPayout}("");
            require(success, "Payout transfer failed");

            contractBalance -= bet.potentialPayout;
            totalLiabilities -= bet.potentialPayout;

            emit PayoutSent(betId, bet.bettor, bet.potentialPayout);
        } else {
            // Bet lost, update liabilities
            totalLiabilities -= bet.potentialPayout;
        }

        emit BetResolved(betId, actualGrade, bet.won);
    }

    /**
     * @dev Get bet details
     */
    function getBet(
        uint256 betId
    )
        external
        view
        returns (
            address bettor,
            uint256 betAmount,
            uint256 gradeThreshold,
            uint256 potentialPayout,
            bool isResolved,
            bool won,
            uint256 timestamp
        )
    {
        require(betId < nextBetId, "Invalid bet ID");
        Bet memory bet = bets[betId];
        return (
            bet.bettor,
            bet.betAmount,
            bet.gradeThreshold,
            bet.potentialPayout,
            bet.isResolved,
            bet.won,
            bet.timestamp
        );
    }

    /**
     * @dev Get active (unresolved) bet IDs for a user
     */
    function getUserActiveBets(
        address user
    ) external view returns (uint256[] memory) {
        uint256 count = 0;

        // Count active bets
        for (uint256 i = 0; i < nextBetId; i++) {
            if (bets[i].bettor == user && !bets[i].isResolved) {
                count++;
            }
        }

        // Collect bet IDs
        uint256[] memory activeBets = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextBetId; i++) {
            if (bets[i].bettor == user && !bets[i].isResolved) {
                activeBets[index++] = i;
            }
        }

        return activeBets;
    }

    /**
     * @dev Admin can withdraw excess funds (not covering liabilities)
     */
    function withdrawExcess() external onlyAdmin {
        uint256 excess = contractBalance - totalLiabilities;
        require(excess > 0, "No excess funds to withdraw");

        contractBalance -= excess;
        (bool success, ) = admin.call{value: excess}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Check contract's available balance for payouts
     */
    function getAvailableBalance() external view returns (uint256) {
        return contractBalance - totalLiabilities;
    }
}
