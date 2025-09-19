import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk'
import './App.css'

const CRYPTO_LOTTO_CONTRACT_ADDRESS = '0x...' // We'll need to update this after deployment

const CRYPTO_LOTTO_ABI = [
  {
    "inputs": [],
    "name": "BET_PRICE",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentRound",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "bettingOpen",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "externalEuint8[6]", "name": "encryptedNumbers", "type": "bytes32[6]"},
      {"internalType": "bytes", "name": "inputProof", "type": "bytes"}
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "roundNumber", "type": "uint256"}],
    "name": "getRoundInfo",
    "outputs": [
      {"internalType": "bool", "name": "hasWinningNumbers", "type": "bool"},
      {"internalType": "bool", "name": "isActive", "type": "bool"},
      {"internalType": "uint256", "name": "totalBets", "type": "uint256"},
      {"internalType": "uint256", "name": "prizePool", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

function App() {
  const { address, isConnected } = useAccount()
  const { writeContract } = useWriteContract()
  
  const [fhevmInstance, setFhevmInstance] = useState<any>(null)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Read contract data
  const { data: betPrice } = useReadContract({
    address: CRYPTO_LOTTO_CONTRACT_ADDRESS as `0x${string}`,
    abi: CRYPTO_LOTTO_ABI,
    functionName: 'BET_PRICE'
  })

  const { data: currentRound } = useReadContract({
    address: CRYPTO_LOTTO_CONTRACT_ADDRESS as `0x${string}`,
    abi: CRYPTO_LOTTO_ABI,
    functionName: 'currentRound'
  })

  const { data: bettingOpen } = useReadContract({
    address: CRYPTO_LOTTO_CONTRACT_ADDRESS as `0x${string}`,
    abi: CRYPTO_LOTTO_ABI,
    functionName: 'bettingOpen'
  })

  const { data: roundInfo } = useReadContract({
    address: CRYPTO_LOTTO_CONTRACT_ADDRESS as `0x${string}`,
    abi: CRYPTO_LOTTO_ABI,
    functionName: 'getRoundInfo',
    args: currentRound ? [currentRound] : undefined
  })

  // Initialize FHEVM instance
  useEffect(() => {
    const initFHEVM = async () => {
      try {
        const instance = await createInstance(SepoliaConfig)
        setFhevmInstance(instance)
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error)
      }
    }
    
    initFHEVM()
  }, [])

  const handleNumberChange = (index: number, value: number) => {
    const newNumbers = [...selectedNumbers]
    newNumbers[index] = Math.min(9, Math.max(0, value))
    setSelectedNumbers(newNumbers)
  }

  const handlePlaceBet = async () => {
    if (!isConnected || !address || !fhevmInstance || !betPrice) {
      alert('Please connect your wallet and wait for initialization')
      return
    }

    try {
      setIsSubmitting(true)

      // Create encrypted input
      const input = fhevmInstance.createEncryptedInput(CRYPTO_LOTTO_CONTRACT_ADDRESS, address)
      
      selectedNumbers.forEach(num => {
        input.add8(num)
      })

      const encryptedInput = await input.encrypt()

      // Place the bet
      writeContract({
        address: CRYPTO_LOTTO_CONTRACT_ADDRESS as `0x${string}`,
        abi: CRYPTO_LOTTO_ABI,
        functionName: 'placeBet',
        args: [encryptedInput.handles, encryptedInput.inputProof],
        value: betPrice
      })

    } catch (error) {
      console.error('Error placing bet:', error)
      alert('Failed to place bet')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎲 CryptoLotto</h1>
        <p>Confidential Lottery powered by FHEVM</p>
        <ConnectButton />
      </header>

      {isConnected && (
        <main className="lottery-interface">
          <div className="game-info">
            <div className="info-card">
              <h3>Current Round</h3>
              <p>#{currentRound?.toString() || 'Loading...'}</p>
            </div>
            
            <div className="info-card">
              <h3>Bet Price</h3>
              <p>{betPrice ? formatEther(betPrice) : 'Loading...'} ETH</p>
            </div>
            
            <div className="info-card">
              <h3>Status</h3>
              <p>{bettingOpen ? 'Open' : 'Closed'}</p>
            </div>

            {roundInfo && (
              <div className="info-card">
                <h3>Prize Pool</h3>
                <p>{formatEther(roundInfo[3])} ETH</p>
              </div>
            )}
          </div>

          <div className="betting-section">
            <h2>Select Your Numbers (0-9)</h2>
            <div className="number-inputs">
              {selectedNumbers.map((number, index) => (
                <input
                  key={index}
                  type="number"
                  min="0"
                  max="9"
                  value={number}
                  onChange={(e) => handleNumberChange(index, parseInt(e.target.value) || 0)}
                  className="number-input"
                />
              ))}
            </div>

            <div className="bet-rules">
              <h3>Prize Rules</h3>
              <ul>
                <li>Match 2 numbers in correct positions: Get your bet back (0.0001 ETH)</li>
                <li>Match all 6 numbers in correct positions: Win 1 ETH!</li>
              </ul>
            </div>

            <button
              onClick={handlePlaceBet}
              disabled={!bettingOpen || isSubmitting || !fhevmInstance}
              className="place-bet-button"
            >
              {isSubmitting ? 'Placing Bet...' : 'Place Bet'}
            </button>
          </div>
        </main>
      )}

      {!isConnected && (
        <div className="connect-prompt">
          <h2>Connect your wallet to start playing!</h2>
          <p>Experience the first confidential lottery where your numbers are encrypted on-chain.</p>
        </div>
      )}
    </div>
  )
}

export default App
