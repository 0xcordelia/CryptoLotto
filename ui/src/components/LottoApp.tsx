import React, { useMemo, useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useAccount, usePublicClient } from 'wagmi';
import { createPublicClient, http, formatEther } from 'viem';
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
  const [priceWei, setPriceWei] = useState<bigint | null>(null);
  const [digits, setDigits] = useState([1, 1, 1, 1]);
  const [drawDigits, setDrawDigits] = useState([0, 0, 0, 0]);
  const [txStatus, setTxStatus] = useState<string>('');
  const [myTickets, setMyTickets] = useState<Array<{ round: number; index: number; d1: string; d2: string; d3: string; d4: string; clear?: [number, number, number, number] | null; loading?: boolean; error?: string | null }>>([]);

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
      setPriceWei(p as bigint);
      if (address) {
        // Fetch user's tickets across all rounds [1..rid]
        const all: Array<{ round: number; index: number; d1: string; d2: string; d3: string; d4: string }> = [];
        for (let r = 1; r <= Number(rid); r++) {
          const res = await publicClient.readContract({
            abi: CONTRACT_ABI as any,
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'getUserTickets',
            args: [BigInt(r), address as `0x${string}`],
          });
          const [a, b, c, d, idxs] = res as any[];
          for (let i = 0; i < (a?.length || 0); i++) {
            all.push({ round: r, index: Number(idxs[i]), d1: a[i], d2: b[i], d3: c[i], d4: d[i] });
          }
        }
        setMyTickets(all);
      } else {
        setMyTickets([]);
      }
    } catch (e) {
      // noop
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function buyTicket() {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError || priceWei === null) return;
    if (digits.some((d) => d === 0)) {
      setTxStatus('Each ticket digit must be 1-9 (no zero).');
      return;
    }
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
    const tx = await c.buyTicket(
      handles[0],
      handles[1],
      handles[2],
      handles[3],
      inputProof,
      { value: priceWei }
    );
    await tx.wait();
    setTxStatus('Ticket purchased.');
    await refresh();
  }

  async function decryptTicket(ti: { round: number; index: number; d1: string; d2: string; d3: string; d4: string }) {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError || !address) return;
    const signer = await signerPromise!;
    const start = Math.floor(Date.now() / 1000).toString();
    const durationDays = '7';
    try {
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, loading: true, error: null } : t)));

      const keypair = zama.generateKeypair();
      const eip712 = zama.createEIP712(keypair.publicKey, [CONTRACT_ADDRESS], start, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: (eip712 as any).types.UserDecryptRequestVerification },
        eip712.message,
      );

      const pairs = [
        { handle: ti.d1, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d2, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d3, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d4, contractAddress: CONTRACT_ADDRESS },
      ];
      const out = await zama.userDecrypt(pairs, keypair.privateKey, keypair.publicKey, signature, [CONTRACT_ADDRESS], address, start, durationDays);
      const values = [ti.d1, ti.d2, ti.d3, ti.d4].map((h) => Number((out as any)[h] ?? 0));
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, clear: values as any, loading: false } : t)));
    } catch (err: any) {
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, loading: false, error: err?.message || 'Decrypt failed' } : t)));
    }
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
              <strong>{priceWei !== null ? `${formatEther(priceWei)} ETH` : '-'}</strong>
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
                  min={1}
                  max={9}
                  value={v}
                  onChange={(e) => {
                    const next = [...digits];
                    const nv = Math.max(1, Math.min(9, Number(e.target.value || 1)));
                    next[i] = nv;
                    setDigits(next);
                  }}
                  style={{ width: 60, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
                />
              ))}
            </div>
            <button onClick={buyTicket} disabled={!isConnected || !isOpen || priceWei === null} style={{ padding: '8px 12px' }}>
              Buy ({priceWei !== null ? `${formatEther(priceWei)} ETH` : '...'} )
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

        <div style={{ marginTop: 24, background: 'white', padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>My Tickets</h3>
          {myTickets.length === 0 ? (
            <p>No tickets yet.</p>
          ) : (
            myTickets.map((t) => (
              <div key={`${t.round}-${t.index}`} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 90 }}>Round #{t.round}</div>
                <div style={{ width: 80 }}>Index {t.index}</div>
                <code style={{ fontSize: 12, color: '#999' }}>{(t.d1 as any).toString().slice(0, 10)}...</code>
                <code style={{ fontSize: 12, color: '#999' }}>{(t.d2 as any).toString().slice(0, 10)}...</code>
                <code style={{ fontSize: 12, color: '#999' }}>{(t.d3 as any).toString().slice(0, 10)}...</code>
                <code style={{ fontSize: 12, color: '#999' }}>{(t.d4 as any).toString().slice(0, 10)}...</code>
                {t.clear ? (
                  <strong style={{ marginLeft: 'auto' }}>
                    {t.clear[0]} {t.clear[1]} {t.clear[2]} {t.clear[3]}
                  </strong>
                ) : (
                  <button onClick={() => decryptTicket(t)} disabled={t.loading} style={{ marginLeft: 'auto' }}>
                    {t.loading ? 'Decrypting...' : 'Decrypt'}
                  </button>
                )}
                {t.error && <span style={{ color: 'red' }}>{t.error}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
