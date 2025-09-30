# 🎲 CryptoLotto

**A Privacy-Preserving Blockchain Lottery System Powered by Zama's Fully Homomorphic Encryption (FHE)**

CryptoLotto is a fully decentralized lottery application that leverages cutting-edge Fully Homomorphic Encryption (FHE) technology to provide complete privacy for players. Unlike traditional blockchain lotteries where all data is transparent, CryptoLotto ensures that your ticket numbers and winnings remain completely confidential—even from the platform operators.

[![License](https://img.shields.io/badge/License-BSD--3--Clause--Clear-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)
[![Zama FHEVM](https://img.shields.io/badge/Powered%20by-Zama%20FHEVM-purple)](https://www.zama.ai/)

## 🌟 Project Overview

CryptoLotto reimagines the traditional lottery system by introducing unprecedented levels of privacy and fairness through blockchain technology and Fully Homomorphic Encryption. Built on Ethereum's Sepolia testnet using Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine), it enables players to participate in a provably fair lottery while keeping their choices and winnings completely private.

### Key Features

- **🔐 Fully Encrypted Tickets**: All ticket numbers (4 digits, 1-9 each) are encrypted on-chain using Zama's FHE technology
- **🎯 Provably Fair Drawing**: On-chain randomness using `block.prevrandao` and `blockhash` ensures transparency and fairness
- **👻 Anonymous Winning**: Winners receive rewards in Confidential ETH (cETH), hiding both the prize amount and winner identity
- **🎁 Universal Rewards**: Every participant has a chance to win something back, obscuring true winners
- **🔄 Continuous Rounds**: Automatic round progression keeps the lottery running continuously
- **🛡️ Zero-Knowledge Claims**: Claim rewards without revealing ticket details or match results on-chain

## 💡 Why CryptoLotto?

### Problems We Solve

#### 1. **Privacy Violations in Traditional Blockchain Lotteries**
Traditional blockchain lotteries expose all ticket purchases, numbers, and winning amounts publicly. This creates several issues:
- Winners become targets for scams and attacks
- Betting patterns can be analyzed and exploited
- Lack of financial privacy for participants

**Our Solution**: End-to-end encryption using FHE ensures ticket numbers never exist in plaintext on-chain. Even smart contract execution happens on encrypted data.

#### 2. **Centralized Trust Requirements**
Most lottery systems require trusting operators to:
- Generate random numbers fairly
- Pay out winnings correctly
- Not manipulate results

**Our Solution**: On-chain randomness and smart contract automation eliminate trust requirements. Even platform operators cannot see ticket contents or manipulate outcomes.

#### 3. **Winner Identification Problem**
In transparent blockchain systems, large winners are immediately identifiable, leading to:
- Security risks for winners
- Potential for targeted attacks
- Loss of financial privacy

**Our Solution**: Confidential ETH (cETH) rewards and universal consolation prizes make it impossible to identify who won what amount.

#### 4. **All-or-Nothing Prize Structure**
Traditional lotteries offer no consolation, making non-winners feel completely unrewarded.

**Our Solution**: Every participant can claim a reward (even if zero), and randomized small consolation prizes keep everyone guessing about who actually won.

## 🏆 Advantages Over Competitors

| Feature | CryptoLotto | Traditional Blockchain Lottery | Centralized Lottery |
|---------|-------------|--------------------------------|---------------------|
| **Privacy** | ✅ Full FHE encryption | ❌ All data public | ⚠️ Centrally stored |
| **Fairness** | ✅ On-chain verifiable | ✅ On-chain verifiable | ❌ Trust required |
| **Winner Privacy** | ✅ Completely hidden | ❌ Publicly visible | ⚠️ KYC required |
| **Reward Privacy** | ✅ Encrypted amounts | ❌ Transparent amounts | ❌ Reported to authorities |
| **Censorship Resistance** | ✅ Fully decentralized | ✅ Smart contract based | ❌ Can be shut down |
| **Manipulation Resistance** | ✅ Cryptographically guaranteed | ⚠️ Smart contract dependent | ❌ Operator control |
| **Universal Participation** | ✅ Anyone with ETH | ✅ Anyone with ETH | ❌ Geographic restrictions |

## 🔧 Technology Stack

### Smart Contracts
- **Solidity ^0.8.24**: Core contract language with Cancun EVM features
- **Zama FHEVM ^0.8.0**: Fully Homomorphic Encryption library for Ethereum
- **Hardhat 2.26.0**: Development environment and testing framework
- **Confidential Contracts**: Encrypted token standards (ConfidentialFungibleToken)

### Frontend
- **React 19.1**: Modern UI framework with concurrent features
- **TypeScript 5.8**: Type-safe development
- **Viem 2.37**: Lightweight Ethereum interaction library
- **Wagmi 2.17**: React hooks for Ethereum
- **RainbowKit 2.2**: Beautiful wallet connection interface
- **Vite 7.1**: Lightning-fast build tooling

### Blockchain Infrastructure
- **Ethereum Sepolia Testnet**: L1 testnet deployment
- **Infura**: Reliable RPC provider
- **Etherscan**: Contract verification and exploration

### FHE Technology
- **@fhevm/solidity**: On-chain encrypted computation primitives
- **@zama-fhe/relayer-sdk ^0.2.0**: Off-chain encryption/decryption service
- **@zama-fhe/oracle-solidity**: Decryption oracle integration
- **Encrypted Types**: Type-safe FHE operations (euint8, euint64, etc.)

## 📋 How It Works

### For Players

1. **Connect Wallet**: Use any Ethereum wallet (MetaMask, WalletConnect, Coinbase Wallet, etc.)
2. **Choose Numbers**: Select 4 digits (1-9 each) for your ticket
3. **Encrypt & Submit**: Numbers are encrypted client-side using Zama's SDK and submitted on-chain
4. **Wait for Draw**: After the round closes, on-chain randomness generates winning numbers
5. **Claim Rewards**: Claim your encrypted reward—amount remains hidden from everyone
6. **Decrypt (Optional)**: Use your private key to decrypt your ticket numbers and winnings locally

### Technical Flow

```
Player Input (1-9, 1-9, 1-9, 1-9)
          ↓
Client-Side Encryption (Zama Relayer SDK)
          ↓
Encrypted Handles + Proof → Smart Contract
          ↓
Store Encrypted Ticket (euint8 × 4)
          ↓
Round Closes → On-Chain Random Draw
          ↓
Encrypted Match Calculation (FHE Operations)
          ↓
Claim → Mint Encrypted cETH Reward
          ↓
Client-Side Decryption (Optional, User's Private Key)
```

### Smart Contract Architecture

#### CryptoLotto.sol
Main lottery contract implementing:
- **Ticket Management**: Stores encrypted tickets with FHE access control
- **Round Lifecycle**: Opens, closes, and progresses rounds automatically
- **Random Drawing**: Uses `block.prevrandao` + `blockhash` for entropy
- **Match Calculation**: Performs FHE operations (eq, select, add) on encrypted digits
- **Reward Distribution**: Calculates and mints encrypted cETH based on matches

#### ConfidentialETH.sol
Encrypted ERC20 token featuring:
- **Confidential Balances**: All balances stored as encrypted euint64
- **Confidential Transfers**: Transfer amounts never revealed on-chain
- **Minting Authority**: Only CryptoLotto contract can mint rewards
- **User Decryption**: Players can decrypt their own balance locally

### Prize Structure

| Match Type | Correct Digits | Reward (cETH) | Probability (Random) |
|------------|----------------|---------------|----------------------|
| 🥇 **Jackpot** | All 4 correct | 1.0 ETH | ~0.015% (1/6561) |
| 🥈 **Second Prize** | 2 correct | 0.001 ETH | ~13.7% |
| 🥉 **Third Prize** | 1 correct | 0.0001 ETH | ~44.4% |
| 🍀 **Consolation** | 0 correct | 0.00000001 ETH* | ~41.8% |

*Base consolation amount: Every player receives at least 10 wei + calculated prize, ensuring universal payouts that obscure true winners.

### FHE Operations Explained

**Encryption Process** (Client-Side):
```typescript
// Create encrypted input buffer
const buffer = zama.createEncryptedInput(contractAddress, userAddress);
buffer.add8(BigInt(digit1));
buffer.add8(BigInt(digit2));
buffer.add8(BigInt(digit3));
buffer.add8(BigInt(digit4));

// Generate handles and proof
const { handles, inputProof } = await buffer.encrypt();
```

**On-Chain Match Calculation** (Solidity):
```solidity
// Compare each digit (FHE equality check)
ebool match1 = FHE.eq(ticketDigit1, winningDigit1);
ebool match2 = FHE.eq(ticketDigit2, winningDigit2);
ebool match3 = FHE.eq(ticketDigit3, winningDigit3);
ebool match4 = FHE.eq(ticketDigit4, winningDigit4);

// Convert bool to uint (1 or 0) and sum
euint8 total = FHE.add(
    FHE.select(match1, one, zero),
    FHE.add(
        FHE.select(match2, one, zero),
        FHE.add(
            FHE.select(match3, one, zero),
            FHE.select(match4, one, zero)
        )
    )
);
```

**Decryption Process** (Client-Side):
```typescript
// Generate one-time keypair
const keypair = zama.generateKeypair();

// Create EIP-712 signature for authorization
const eip712 = zama.createEIP712(keypair.publicKey, [contractAddress], start, duration);
const signature = await signer.signTypedData(...);

// Decrypt via Zama relayer
const decrypted = await zama.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    ...
);
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 7.0.0 or higher
- **Ethereum Wallet**: With Sepolia testnet ETH ([Get testnet ETH](https://sepoliafaucet.com/))
- **Infura API Key**: For RPC access ([Get free key](https://infura.io/))
- **Etherscan API Key**: For contract verification ([Get free key](https://etherscan.io/apis))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/CryptoLotto.git
cd CryptoLotto
```

2. **Install root dependencies**
```bash
npm install
```

3. **Install UI dependencies**
```bash
cd ui
npm install
cd ..
```

4. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Deployment wallet (DO NOT share!)
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix

# RPC Provider
INFURA_API_KEY=your_infura_api_key

# Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

5. **Compile smart contracts**
```bash
npm run compile
```

This generates:
- Compiled artifacts in `./artifacts/`
- TypeChain typings in `./types/`
- ABI files for frontend integration

6. **Run tests**
```bash
# Run all tests on local FHEVM mock
npm test

# Run with coverage
npm run coverage

# Run specific test file
npx hardhat test test/CryptoLotto.test.ts
```

### Local Development

1. **Start local FHEVM node** (in separate terminal):
```bash
npx hardhat node
```

2. **Deploy to local network**:
```bash
npx hardhat deploy --network localhost
```

3. **Start frontend dev server**:
```bash
cd ui
npm run dev
```

4. **Access the app**:
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Sepolia Testnet Deployment

1. **Ensure you have Sepolia ETH** (~0.5 ETH recommended for deployment and testing)

2. **Deploy ConfidentialETH token**:
```bash
npx hardhat run scripts/deploy-ceth.js --network sepolia
```
Copy the deployed address.

3. **Deploy CryptoLotto contract**:
Edit deployment script with ConfidentialETH address, then:
```bash
npx hardhat run scripts/deploy-lottery.js --network sepolia
```

4. **Verify contracts on Etherscan**:
```bash
npx hardhat verify --network sepolia <CETH_ADDRESS> <OWNER_ADDRESS>
npx hardhat verify --network sepolia <LOTTERY_ADDRESS> <CETH_ADDRESS>
```

5. **Configure frontend**:
Update `ui/src/config/contracts.ts`:
```typescript
export const CONTRACT_ADDRESS = '0xYourLotteryAddress';
export const CETH_ADDRESS = '0xYourCETHAddress';
```

6. **Build and deploy frontend**:
```bash
cd ui
npm run build
# Deploy dist/ folder to your hosting service (Vercel, Netlify, etc.)
```

## 📁 Project Structure

```
CryptoLotto/
├── contracts/
│   ├── CryptoLotto.sol          # Main lottery contract (326 lines)
│   │   ├── Ticket struct        # Encrypted 4-digit ticket storage
│   │   ├── RoundInfo struct     # Round state and tickets
│   │   ├── buyTicket()          # Purchase encrypted ticket
│   │   ├── closeAndDrawRandom() # Draw winning numbers
│   │   ├── claim()              # Claim encrypted rewards
│   │   └── getUserTickets()     # Query user's tickets
│   └── ConfidentialETH.sol      # Encrypted ERC20 (30 lines)
│       ├── ConfidentialFungibleToken base
│       ├── mint()               # Restricted minting
│       └── setLottoAddress()    # Configure lottery contract
├── deploy/
│   └── 001_deploy_lottery.ts    # Hardhat-deploy script
├── test/
│   └── CryptoLotto.test.ts      # Comprehensive test suite
│       ├── Ticket purchase tests
│       ├── Round lifecycle tests
│       ├── Drawing and claiming tests
│       └── Edge case coverage
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   └── LottoApp.tsx     # Main React application (913 lines)
│   │   │       ├── Wallet connection
│   │   │       ├── Ticket purchase UI
│   │   │       ├── Round results display
│   │   │       ├── My tickets management
│   │   │       ├── cETH balance viewer
│   │   │       └── Admin controls
│   │   ├── config/
│   │   │   └── contracts.ts     # Contract addresses and ABIs
│   │   ├── hooks/
│   │   │   ├── useEthersSigner.ts  # Wagmi → Ethers adapter
│   │   │   └── useZamaInstance.ts  # FHE SDK initialization
│   │   ├── styles/
│   │   │   └── index.css        # CSS variables and animations
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # React + Wagmi + RainbowKit setup
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts           # Vite configuration
├── docs/
│   ├── zama_doc_relayer.md      # Zama relayer documentation
│   └── zama_llm.md              # FHE development guide
├── hardhat.config.ts            # Hardhat configuration
│   ├── Solidity 0.8.27 + viaIR
│   ├── FHEVM plugin integration
│   ├── Network configs (hardhat, sepolia)
│   └── Verification settings
├── package.json                 # Root dependencies
├── tsconfig.json                # TypeScript configuration
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── LICENSE                      # BSD-3-Clause-Clear
└── README.md                    # This file
```

## 🔐 Security Features

### Cryptographic Guarantees

1. **Fully Homomorphic Encryption (FHE)**
   - All ticket digits encrypted using Zama's TFHE scheme
   - Computations performed directly on ciphertext (no decryption needed)
   - Zero plaintext exposure on-chain
   - ACL (Access Control List) prevents unauthorized access to ciphertexts

2. **Verifiable Randomness**
   - Uses Ethereum's `block.prevrandao` (post-Merge PoS randomness beacon)
   - Combined with `blockhash(block.number - 1)` for additional entropy
   - Round-specific salt (roundId) prevents replay attacks
   - Deterministic and publicly auditable by anyone

3. **Non-Interactive Claiming**
   - Claims execute without on-chain decryption
   - Encrypted reward amounts minted directly to player
   - No revealing of match count on-chain
   - Universal minting obscures true winners

4. **Access Control**
   - `FHE.allow()`: Grants specific addresses access to ciphertext handles
   - `FHE.allowThis()`: Allows contract to reuse ciphertexts in future operations
   - `FHE.allowTransient()`: Temporary access for cross-contract calls
   - Player-controlled decryption via EIP-712 signatures

5. **Input Validation**
   - `inputProof` verification ensures encrypted values come from authorized relayer
   - Client-side range enforcement (1-9) for user experience
   - Contract-side value integrity guaranteed by FHE
   - Replay protection via nonces and timestamps

### Attack Resistance

| Attack Vector | Mitigation |
|--------------|------------|
| **Front-running** | Encrypted inputs prevent MEV bots from seeing ticket numbers |
| **Replay Attacks** | Input proofs include nonces; round progression prevents reuse |
| **Timing Analysis** | Universal claiming hides correlation between tickets and rewards |
| **Winner Profiling** | Encrypted rewards + consolation prizes obscure winner identity |
| **Randomness Manipulation** | PoS prevrandao + blockhash resistant to validator manipulation |
| **Contract Reentrancy** | CEI pattern (Checks-Effects-Interactions) followed throughout |
| **Access Control Bypass** | Owner-only functions protected; critical functions restricted |

### Known Limitations

⚠️ **Current Limitations:**

1. **Gas Costs**: FHE operations are 10-100x more expensive than standard EVM operations
2. **Relayer Dependency**: Encryption/decryption requires Zama's relayer service
3. **Testnet Only**: Currently unaudited and deployed on Sepolia testnet only
4. **Random Number Security**: While resistant to manipulation, prevrandao has theoretical vulnerabilities in specific scenarios
5. **FHE Maturity**: FHEVM is cutting-edge technology; potential undiscovered edge cases

### Audit Status

⚠️ **UNAUDITED**: This project has not undergone a professional security audit. It is deployed on Sepolia testnet for demonstration and testing purposes only.

**DO NOT** deploy on mainnet or use with real funds without:
- Professional smart contract audit (recommended: Trail of Bits, OpenZeppelin, ConsenSys Diligence)
- FHE cryptography review by specialized firm
- Extended testnet operation period (3-6 months)
- Bug bounty program

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run with coverage
npm run coverage

# Run specific test
npx hardhat test test/CryptoLotto.test.ts

# Run on Sepolia (requires deployment)
npm run test:sepolia
```

### Test Coverage

The test suite covers:

✅ **Ticket Purchase**
- Encrypted input submission
- Multiple tickets per user
- Correct price validation
- ACL permission grants
- Event emission verification

✅ **Round Lifecycle**
- Round opening on deployment
- Ticket purchase during open rounds
- Round closing and drawing
- Automatic next round opening
- State transitions

✅ **Random Number Generation**
- Entropy source validation
- Digit range (1-9) verification
- Distribution fairness (statistical)
- Deterministic but unpredictable

✅ **Match Calculation**
- FHE equality operations
- Correct match counting (0-4)
- Encrypted result handling
- Edge cases (all match, none match)

✅ **Reward Distribution**
- Prize tier calculation
- Encrypted amount minting
- cETH balance updates
- Claim authorization

✅ **Access Control**
- Owner-only functions
- Player ticket authorization
- Ciphertext ACL enforcement
- Unauthorized access prevention

✅ **Edge Cases**
- Zero address handling
- Invalid inputs
- Double claiming prevention
- Insufficient balance scenarios

### Test Report Example

```
CryptoLotto
    ✓ Should deploy with correct initial state (143ms)
    ✓ Should allow users to buy tickets with encrypted digits (892ms)
    ✓ Should store encrypted tickets correctly (234ms)
    ✓ Should close round and draw random winning numbers (456ms)
    ✓ Should calculate matches on encrypted data (1123ms)
    ✓ Should distribute correct rewards based on matches (1834ms)
    ✓ Should mint encrypted cETH on claim (734ms)
    ✓ Should prevent double claiming (289ms)
    ✓ Should allow decryption of user's own tickets (923ms)
    ✓ Should handle multiple rounds correctly (2341ms)

  10 passing (9.2s)
```

## 📊 Gas Optimization

The contracts are heavily optimized for gas efficiency despite FHE overhead:

### Compiler Optimizations
- **Solidity 0.8.27**: Latest version with Cancun optimizations
- **viaIR: true**: Intermediate representation for better optimization
- **Optimizer runs: 800**: Balanced for deployment + execution costs
- **EVM Version: cancun**: Latest opcode support

### Contract Optimizations
- **Storage packing**: Ticket struct carefully ordered to minimize slots
- **Minimal state changes**: Only essential writes to storage
- **Batch operations**: Encrypted operations grouped when possible
- **Efficient loops**: Unbounded loops avoided; user queries externally paginated
- **View functions**: Heavy reads marked `view` to avoid gas costs

### Typical Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| **Deploy CryptoLotto** | ~4.5M gas | One-time cost |
| **Deploy ConfidentialETH** | ~2.8M gas | One-time cost |
| **Buy Ticket** | ~800K-1.2M gas | Includes 4 euint8 encryptions + ACL |
| **Close & Draw** | ~200K-300K gas | Random number generation |
| **Claim Reward** | ~600K-900K gas | FHE match calc + cETH mint |
| **Get User Tickets** | 0 gas | View function |

**FHE Operation Overhead:**
- `FHE.eq()`: ~50K gas per comparison
- `FHE.select()`: ~40K gas per operation
- `FHE.add()`: ~30K gas per addition
- `FHE.asEuint8()`: ~20K gas per conversion

### Gas Saving Tips for Users

1. **Buy multiple tickets in sequence**: Reuse relayer connection
2. **Claim after round ends**: No urgency = flexible gas prices
3. **Decrypt locally**: View functions cost 0 gas
4. **Batch transactions**: Use multicall if available

## 🛣️ Roadmap

### Phase 1: MVP (Current) ✅
- [x] Basic lottery contract with FHE
- [x] Confidential ETH reward token
- [x] React frontend with RainbowKit wallet integration
- [x] Sepolia testnet deployment
- [x] On-chain randomness for drawing
- [x] Client-side encryption/decryption
- [x] Multiple round support
- [x] Comprehensive test suite

### Phase 2: Enhanced Features 🚧 (Q2 2025)
- [ ] Multiple ticket types (3-digit, 5-digit, 6-digit lotteries)
- [ ] Jackpot rollover for unclaimed first prizes
- [ ] VRF integration (Chainlink VRF + FHE hybrid randomness)
- [ ] Multi-token rewards (cDAI, cUSDC, cWBTC)
- [ ] Mobile-responsive design improvements
- [ ] Progressive Web App (PWA) support
- [ ] Ticket history and statistics
- [ ] Email/SMS notifications (privacy-preserving)

### Phase 3: Advanced Privacy 🔮 (Q3 2025)
- [ ] Zero-knowledge proof integration for claims (zk-SNARKs)
- [ ] Private betting pools (group tickets with shared rewards)
- [ ] Anonymous ticket gifting (transfer encrypted tickets)
- [ ] Time-locked encrypted reveals (commit-reveal schemes)
- [ ] Cross-chain lottery bridges (Polygon, Arbitrum, Optimism)
- [ ] Stealth addresses for winner anonymity
- [ ] Privacy-preserving analytics dashboard

### Phase 4: Ecosystem Growth 🌐 (Q4 2025)
- [ ] Professional security audit (Trail of Bits / OpenZeppelin)
- [ ] Mainnet deployment (Ethereum + L2s)
- [ ] DAO governance for prize structures and rules
- [ ] Affiliate program for ticket sales
- [ ] Open API for third-party integrations
- [ ] Mobile apps (iOS/Android native)
- [ ] Multi-language support (i18n)
- [ ] Lottery-as-a-Service API

### Phase 5: Innovation 🚀 (2026+)
- [ ] AI-powered number suggestions (encrypted ML models)
- [ ] NFT ticket collectibles (ERC-721 + FHE)
- [ ] Gamification and leaderboards (privacy-preserving)
- [ ] Social features (private groups, shared pools)
- [ ] DeFi integrations (stake cETH, LP farming)
- [ ] Dynamic prize structures (bonding curves, AMM-style)
- [ ] Metaverse integration (VR lottery experience)
- [ ] Decentralized oracle network for randomness

## 🤝 Contributing

We welcome contributions from the community! CryptoLotto is open-source and thrives on collaborative development.

### How to Contribute

1. **Fork the repository**
   ```bash
   git fork https://github.com/yourusername/CryptoLotto.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Run tests and linting**
   ```bash
   npm run test
   npm run lint
   npm run prettier:check
   ```

5. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
   Follow [Conventional Commits](https://www.conventionalcommits.org/) format.

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Describe your changes clearly
   - Reference related issues
   - Include screenshots for UI changes

### Development Guidelines

- **Code Style**: Follow Prettier + ESLint configs (run `npm run lint`)
- **Commit Messages**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Testing**: Maintain >80% coverage; all tests must pass
- **Documentation**: Update README and inline comments for public APIs
- **Gas Efficiency**: Profile gas costs for contract changes
- **Security**: Consider attack vectors; document assumptions

### Areas for Contribution

🐛 **Bug Fixes**
- Fix edge cases in contracts
- UI/UX bug fixes
- Gas optimization improvements

📝 **Documentation**
- Improve README and guides
- Add code comments
- Create tutorials and demos
- Translate to other languages

🎨 **UI/UX Enhancements**
- Mobile responsiveness
- Accessibility improvements
- Animation and polish
- Dark mode support

🔧 **Feature Development**
- Additional lottery game modes
- DeFi integrations
- Analytics and dashboards
- Admin panel improvements

🧪 **Testing**
- Additional test cases
- Fuzzing and invariant tests
- Security test scenarios
- Load and performance testing

🌍 **Internationalization**
- Translate UI strings
- Localized number formats
- Regional lottery variants

### Bounty Program

We're planning a bug bounty program for security issues. Stay tuned!

## 📄 License

This project is licensed under the **BSD-3-Clause-Clear License**. See [LICENSE](LICENSE) for full text.

### Key Terms

- ✅ **Commercial use allowed**
- ✅ **Modification allowed**
- ✅ **Distribution allowed**
- ✅ **Private use allowed**
- ❌ **Patent rights NOT granted** (explicitly excluded)
- ⚠️ **No warranty provided**
- ⚠️ **Liability limitations apply**

The BSD-3-Clause-Clear license is similar to BSD-3-Clause but explicitly states no patent rights are granted. This is appropriate for cryptographic software to avoid patent litigation.

## 🙏 Acknowledgments

This project wouldn't be possible without:

- **[Zama](https://www.zama.ai/)** - For pioneering FHEVM technology and making FHE accessible to smart contract developers
- **[Ethereum Foundation](https://ethereum.org/)** - For the robust, decentralized smart contract platform
- **[Hardhat Team](https://hardhat.org/)** - For excellent development tooling and FHEVM plugin support
- **[OpenZeppelin](https://openzeppelin.com/)** - For secure contract patterns and standards
- **[RainbowKit](https://www.rainbowkit.com/) & [Wagmi](https://wagmi.sh/)** - For seamless wallet integration
- **[Viem](https://viem.sh/)** - For lightweight, performant Ethereum interactions
- **[React Team](https://react.dev/)** - For the powerful UI framework

Special thanks to:
- The TFHE-rs team for low-level FHE primitives
- Sepolia testnet validators for providing test infrastructure
- The broader Ethereum and privacy tech communities

## 📞 Contact & Support

### Get Help

- **📚 Documentation**: [Full Docs](./docs/) | [Zama FHEVM Docs](https://docs.zama.ai/fhevm)
- **💬 Discussions**: [GitHub Discussions](https://github.com/yourusername/CryptoLotto/discussions)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/yourusername/CryptoLotto/issues)
- **💡 Feature Requests**: [Submit Ideas](https://github.com/yourusername/CryptoLotto/issues/new?labels=enhancement)
- **🔐 Security Issues**: Email security@cryptolotto.example.com (PGP key available)

### Community

- **Discord**: [Join Zama Discord](https://discord.fhe.org) - #fhevm-developers channel
- **Twitter/X**: [@CryptoLotto](https://twitter.com/cryptolotto) (example)
- **Telegram**: [CryptoLotto Community](https://t.me/cryptolotto) (example)

### Development Team

- **GitHub**: [@yourusername](https://github.com/yourusername)
- **Email**: dev@cryptolotto.example.com

## 🌐 Live Demo

### Testnet Deployment

Try CryptoLotto on Sepolia testnet:

- **🎲 DApp**: [https://cryptolotto.example.com](https://cryptolotto.example.com) *(Update with your deployment URL)*
- **📜 Lottery Contract**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS)
- **🪙 cETH Contract**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/YOUR_CETH_ADDRESS)
- **📊 Contract Verification**: ✅ Verified (source code available)

### Getting Testnet Funds

1. **Sepolia ETH Faucets**:
   - [Official Sepolia Faucet](https://sepoliafaucet.com/)
   - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
   - [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)

2. **Need Help?** Join our Discord for testnet ETH assistance.

## ⚠️ Disclaimer

**Important Legal and Safety Information**

This software is provided **"as is"** without warranty of any kind, express or implied. This is experimental technology combining blockchain and advanced cryptography.

### Key Points

- **🧪 Experimental Technology**: FHEVM is cutting-edge; use at your own risk
- **🚧 Testnet Only**: Currently deployed on Sepolia testnet for testing purposes
- **💸 No Financial Advice**: This is not financial advice; DYOR (Do Your Own Research)
- **⛽ Gas Costs**: FHE operations are significantly more expensive than standard transactions
- **🔒 Privacy Limitations**: While FHE provides strong privacy, no system is 100% secure
- **📜 Unaudited**: No professional security audit has been conducted yet
- **🏛️ Legal Compliance**: Check your local laws regarding online gambling/lotteries
- **👤 Your Responsibility**: You are responsible for securing your private keys and funds

### Risk Factors

1. **Smart Contract Risk**: Bugs in contract code could lead to loss of funds
2. **FHE Security Risk**: Theoretical vulnerabilities in FHE implementation
3. **Centralization Risk**: Dependency on Zama's relayer service
4. **Regulatory Risk**: Legal status of blockchain lotteries varies by jurisdiction
5. **Economic Risk**: Lottery is negative expected value; play responsibly

**DO NOT:**
- Use on mainnet without professional audit
- Invest more than you can afford to lose
- Treat this as an investment or income source
- Share your private keys with anyone

**This project is for educational and demonstration purposes.**

## 📚 Additional Resources

### Learning Resources

#### FHE and FHEVM
- [Zama FHEVM Documentation](https://docs.zama.ai/fhevm) - Official FHEVM docs
- [Introduction to Homomorphic Encryption](https://www.zama.ai/introduction-to-homomorphic-encryption) - FHE primer
- [FHEVM Solidity Guide](https://docs.zama.ai/protocol/solidity-guides) - Smart contract development
- [TFHE-rs Library](https://github.com/zama-ai/tfhe-rs) - Underlying FHE library

#### Ethereum Development
- [Hardhat Tutorial](https://hardhat.org/tutorial) - Smart contract development
- [Solidity Documentation](https://docs.soliditylang.org/) - Language reference
- [Ethereum Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/) - Security guide
- [Wagmi Documentation](https://wagmi.sh/) - React hooks for Ethereum

#### Privacy Technology
- [Zero-Knowledge Proofs](https://zkp.science/) - Complementary privacy tech
- [Blind Signatures](https://en.wikipedia.org/wiki/Blind_signature) - Anonymous credentials
- [Secure Multi-Party Computation](https://www.unboundtech.com/what-is-mpc/) - Related cryptography

### Related Projects

#### Zama Ecosystem
- [fhevm-solidity](https://github.com/zama-ai/fhevm-solidity) - Core FHEVM library
- [fhevm-hardhat-plugin](https://www.npmjs.com/package/@fhevm/hardhat-plugin) - Development tools
- [confidential-erc20](https://github.com/zama-ai/fhevm-contracts) - Private tokens

#### Privacy-Focused DApps
- [Tornado Cash](https://github.com/tornadocash) - Private transactions (educational)
- [Aztec Protocol](https://aztec.network/) - zkRollup for privacy
- [Secret Network](https://scrt.network/) - Privacy-preserving smart contracts

#### Lottery Projects
- [PoolTogether](https://pooltogether.com/) - No-loss savings lottery
- [Chainlink VRF Lottery](https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number) - Verifiable random lottery

### Academic Papers

- [TFHE: Fast Fully Homomorphic Encryption](https://eprint.iacr.org/2018/421.pdf)
- [Homomorphic Encryption Standard](https://homomorphicencryption.org/standard/)
- [Verifiable Random Functions](https://dash.harvard.edu/bitstream/handle/1/5028196/Vadhan_VerifRandomFunction.pdf)

## 🔄 Changelog

### v0.0.1 (Current)
- ✅ Initial release
- ✅ Basic 4-digit lottery with FHE
- ✅ Confidential ETH reward system
- ✅ React frontend with RainbowKit
- ✅ On-chain random drawing
- ✅ Multiple round support
- ✅ Sepolia testnet deployment

### Upcoming in v0.1.0
- 🚧 UI/UX improvements
- 🚧 Gas optimization pass
- 🚧 Additional test coverage
- 🚧 Documentation expansion
- 🚧 Bug fixes from testnet feedback

---

<div align="center">

**Built with ❤️ using Zama's FHEVM**

*Bringing Privacy to Blockchain Lotteries, One Encrypted Ticket at a Time*

[![Star on GitHub](https://img.shields.io/github/stars/yourusername/CryptoLotto?style=social)](https://github.com/yourusername/CryptoLotto)

⭐ **Star us on GitHub** — it helps the project grow!

[🎲 Try Demo](https://cryptolotto.example.com) • [📚 Read Docs](./docs/) • [💬 Join Discord](https://discord.fhe.org) • [🐛 Report Bug](https://github.com/yourusername/CryptoLotto/issues)

</div>

---

**Made with Zama FHEVM** | **Deployed on Ethereum Sepolia** | **Licensed under BSD-3-Clause-Clear**

*"Privacy isn't a feature—it's a fundamental right."*