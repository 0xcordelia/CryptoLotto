import React, { useMemo, useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Header } from './Header';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useAccount, usePublicClient } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

export function LottoApp() {
  const { address, isConnected } = useAccount();
  const viemClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance: zama, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [roundId, setRoundId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [price, setPrice] = useState<string>('');
  const [digits, setDigits] = useState([0, 0, 0, 0]);
  const [drawDigits, setDrawDigits] = useState([0, 0, 0, 0]);
  const [txStatus, setTxStatus] = useState<string>('');

  const publicClient = useMemo(() => {
    // Ensure no localhost usage; use Sepolia RPC from the injected wagmi client
    if (viemClient) return viemClient;
    return createPublicClient({ chain: sepolia, transport: http() });
  }, [viemClient]);

  async function refresh() {
    try {
      const [rid, open, p] = await Promise.all([
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'getCurrentRoundId',
        }),
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'isOpen',
        }),
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'TICKET_PRICE',
        }),
      ]);
      setRoundId(Number(rid));
      setIsOpen(Boolean(open));
      setPrice((BigInt(p as any)).toString());
    } catch (e) {
      // noop
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function buyTicket() {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError) return;
    setTxStatus('Encrypting...');
    const buffer = zama.createEncryptedInput(CONTRACT_ADDRESS, address!);
    buffer.add8(BigInt(digits[0]));
    buffer.add8(BigInt(digits[1]));
    buffer.add8(BigInt(digits[2]));
    buffer.add8(BigInt(digits[3]));
    const { handles, inputProof } = await buffer.encrypt();

    setTxStatus('Submitting transaction...');
    const signer = await signerPromise!;
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, signer);
    const tx = await c.buyTicket(handles[0], handles[1], handles[2] , handles[3] , inputProof, {
      value: price,
    });
    await tx.wait();
    setTxStatus('Ticket purchased.');
    await refresh();
  }

  async function adminDraw() {
    if (!isConnected || !signerPromise) return;
    setTxStatus('Closing round and drawing...');
    const signer = await signerPromise!;
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, signer);
    const tx = await c.closeAndDraw(drawDigits[0], drawDigits[1], drawDigits[2], drawDigits[3]);
    await tx.wait();
    setTxStatus('Draw requested. Await decryption + payouts.');
    await refresh();
  }

  return (
    <div>
      <Header />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: '#555' }}>Contract</div>
            <div style={{ fontFamily: 'monospace' }}>{CONTRACT_ADDRESS}</div>
          </div>
          <ConnectButton />
        </div>

        <div style={{ background: 'white', padding: 16, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div>Round</div>
              <strong>#{roundId ?? '-'}</strong>
            </div>
            <div>
              <div>Status</div>
              <strong>{isOpen ? 'Open' : 'Closed'}</strong>
            </div>
            <div>
              <div>Ticket Price</div>
              <strong>{price ? `${price} wei` : '-'}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'white', padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Buy Ticket</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {digits.map((v, i) => (
                <input
                  key={i}
                  type="number"
                  min={0}
                  max={9}
                  value={v}
                  onChange={(e) => {
                    const next = [...digits];
                    const nv = Math.max(0, Math.min(9, Number(e.target.value || 0)));
                    next[i] = nv;
                    setDigits(next);
                  }}
                  style={{ width: 60, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
                />
              ))}
            </div>
            <button onClick={buyTicket} disabled={!isConnected || !isOpen} style={{ padding: '8px 12px' }}>
              Buy ({price ? `${price} wei` : '...'} )
            </button>
          </div>

          <div style={{ background: 'white', padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Admin Draw</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {drawDigits.map((v, i) => (
                <input
                  key={i}
                  type="number"
                  min={0}
                  max={9}
                  value={v}
                  onChange={(e) => {
                    const next = [...drawDigits];
                    const nv = Math.max(0, Math.min(9, Number(e.target.value || 0)));
                    next[i] = nv;
                    setDrawDigits(next);
                  }}
                  style={{ width: 60, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
                />
              ))}
            </div>
            <button onClick={adminDraw} disabled={!isConnected || isOpen} style={{ padding: '8px 12px' }}>
              Close & Draw
            </button>
          </div>
        </div>

        {txStatus && (
          <div style={{ marginTop: 16, color: '#333' }}>
            <em>{txStatus}</em>
          </div>
        )}

        <div style={{ marginTop: 24, background: 'white', padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Recent Winners</h3>
          <p>Use a block explorer or subscribe to PrizeAwarded events to display winners.</p>
        </div>
      </div>
    </div>
  );
}
