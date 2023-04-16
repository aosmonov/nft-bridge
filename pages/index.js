import Head from "next/head";
import { Inter } from "next/font/google";
import { Contract, ethers } from "ethers";
import React, { useEffect, useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.css";
import Metamask from "./components/Metamask";
import Web3Modal from "web3modal";
import {
  NFT_ABI,
  MINTED_CONTRACT,
  NFT_BRIDGE_ABI,
  NFT_BRIDGE_BNB,
  ERC20_ABI,
  MINTED_ABI,
  PAY_CONTRACT,
  NFT_BRIDGE_POLYGON,
  ZERO_ADDRESS,
} from "@/constants";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const web3ModalRef = useRef();

  const [nfts, setNfts] = useState([]);
  const [tokens, setTokens] = useState([]);

  const readNfts = async () => {
    try {
      const provider = await web3ModalRef.current.connect();
      const web3Provider = new ethers.providers.Web3Provider(provider);
      const signer = web3Provider.getSigner();
      const currentUser = await signer.getAddress();

      const network = await web3Provider.getNetwork();

      console.log(network.chainId);

      const _nfts = [];
      if (network.chainId === 97) {
        const nftContract = new Contract(MINTED_CONTRACT, MINTED_ABI, signer);
        const maxId = Number(await nftContract.getCurrentId());

        for (let i = maxId; i > 0; i--) {
          const tokenUri = await nftContract.tokenURI(i);
          const owner = await nftContract.ownerOf(i);

          _nfts.push({
            uri: tokenUri,
            id: i,
            canTransfer: owner == currentUser,
            canReturn: false,
          });
        }
      } else {
        const nftContract = new Contract(
          NFT_BRIDGE_POLYGON,
          NFT_BRIDGE_ABI,
          signer
        );

        const contractAddress = await nftContract.nfts(MINTED_CONTRACT);

        const polygonNft = new Contract(contractAddress, NFT_ABI, signer);
        const res = await polygonNft.getUserNFT(currentUser);

        for (let i = 0; i < res.length; i++) {
          const tokenUri = await polygonNft.tokenURI(res[i]);

          _nfts.push({
            uri: tokenUri,
            id: res[i],
            canTransfer: false,
            canReturn: true,
            address: contractAddress,
          });
        }

        console.log(res);
      }

      setNfts(_nfts);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (walletConnected) {
      readNfts();
    }
  }, [walletConnected]);

  useEffect(() => {
    const getAll = async (nfts) => {
      const promises = [];
      nfts.map((nft) => {
        promises.push(
          fetch(nft.uri)
            .then((res) => res.json())
            .then((resJson) => {
              return {
                ...resJson,
                id: nft.id,
                canTransfer: nft.canTransfer,
                canReturn: nft.canReturn,
                address: nft.address,
              };
            })
        );
      });

      const result = await Promise.all(promises);

      setTokens(result);
    };

    if (nfts.length > 0) {
      getAll(nfts);
    }
  }, [nfts]);

  const read = async () => {
    console.log("read");
  };

  const transfer = async (tokenId) => {
    console.log("Token id to transfer------------");
    console.log(tokenId);

    const provider = await web3ModalRef.current.connect();
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const signer = web3Provider.getSigner();

    const bridgeContract = new Contract(NFT_BRIDGE_BNB, NFT_BRIDGE_ABI, signer);

    const commissionERC20 = String(await bridgeContract.commissionERC20());
    console.log("Comission ERC20------------");
    console.log(commissionERC20);

    console.log(bridgeContract.address);

    const erc20Contract = new Contract(PAY_CONTRACT, ERC20_ABI, signer);
    const ercRes = await erc20Contract.approve(
      bridgeContract.address,
      commissionERC20
    );
    console.log(ercRes);

    const nftContract = new Contract(MINTED_CONTRACT, MINTED_ABI, signer);
    const nftRes = await nftContract.approve(bridgeContract.address, tokenId);
    console.log(nftRes);

    const res = await bridgeContract.changePayERC20(MINTED_CONTRACT, tokenId, {
      gasLimit: 4000000,
    });

    console.log("Result of changePayERC20");
    console.log(res);

    let holder;
    let tokenAddress;
    let tokenId2;
    let tokenUri;

    const tx = await res.wait();
    for (let i = 0; i < tx.events.length; i++) {
      if (tx.events[i].event == "NFTChanged") {
        holder = tx.events[i].args.holder;
        tokenAddress = tx.events[i].args.tokenAddress;
        tokenId2 = tx.events[i].args.tokenId;
        tokenUri = tx.events[i].args.uri;
      }
    }

    const nftName = await nftContract.name();
    const nftSymbol = await nftContract.symbol();

    await askPolygon(
      holder,
      tokenAddress,
      tokenId2,
      tokenUri,
      nftName,
      nftSymbol
    );
  };

  const askPolygon = async (
    holder,
    tokenAddress,
    tokenId,
    tokenUri,
    nftName,
    nftSymbol
  ) => {
    console.log(holder);
    console.log(tokenAddress);
    console.log(tokenId);
    console.log(tokenUri);
    console.log(nftName);
    console.log(nftSymbol);

    const web3Modal = new Web3Modal({
      providerOptions: {},
      disableInjectedProvider: false,
    });
    const providerPolygon = await web3Modal.connect();
    const web3ProviderPolygon = new ethers.providers.Web3Provider(
      providerPolygon
    );

    console.log(providerPolygon);
    console.log(web3ProviderPolygon);

    const signer = web3ProviderPolygon.getSigner();

    const bridgeContract = new Contract(
      NFT_BRIDGE_POLYGON,
      NFT_BRIDGE_ABI,
      signer
    );

    console.log(bridgeContract);

    const nftAddress = await bridgeContract.nfts(tokenAddress);
    if (nftAddress == ZERO_ADDRESS) {
      const tx = await bridgeContract
        .newNFT(nftName, nftSymbol, tokenAddress)
        .wait();

      let newTokenAddress;
      for (let i = 0; i < tx.events.length; i++) {
        if (tx.events[i].event == "NewNFT") {
          newTokenAddress = tx.events[i].args.tokenAddress;
        }
      }

      const nftContract = new Contract(
        newTokenAddress,
        NFT_ABI,
        providerPolygon
      );
      await nftContract.mint(holder, tokenId, tokenUri);
    } else {
      let owner;
      const nftContract = new Contract(nftAddress, NFT_ABI, signer);
      try {
        owner = await nftContract.ownerOf(tokenId);
        if (owner.toLowerCase() == bridgeContract.address.toLowerCase()) {
          await bridgeContract.sendNFT(holder, tokenAddress, tokenId);
        }
      } catch (error) {
        await nftContract.mint(holder, tokenId, tokenUri);
      }
    }
  };

  const sendBack = async (tokenId, contractAddress) => {
    console.log("Send back ------");
    console.log(tokenId);
    console.log(contractAddress);

    const provider = await web3ModalRef.current.connect();
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const signer = web3Provider.getSigner();
    const currentUser = await signer.getAddress();

    const bridgeContract = new Contract(
      NFT_BRIDGE_POLYGON,
      NFT_BRIDGE_ABI,
      signer
    );

    const commissionCoin = String(await bridgeContract.commissionCoin());
    console.log("Comission Coin------------");
    console.log(commissionCoin);

    console.log(bridgeContract.address);

    const nftContract = new Contract(contractAddress, NFT_ABI, signer);
    const nftRes = await nftContract.approve(bridgeContract.address, tokenId);
    console.log(nftRes);

    const res = await bridgeContract.changePayCoin(contractAddress, tokenId, {
      gasLimit: 4000000,
      value: commissionCoin,
    });

    console.log(await res.wait());

    const bnbAddress = await bridgeContract.nfts(contractAddress);

    const sendRes = await bridgeContract.sendNFT(
      currentUser,
      bnbAddress,
      tokenId
    );

    console.log(await sendRes.wait());
  };

  return (
    <>
      <Head>
        <title>NFT Bridge</title>
        <meta name="description" content="NFT Bridge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <nav className="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
        <div className="container">
          <a className="navbar-brand" href="#">
            WeCore
          </a>
          <div className="collapse navbar-collapse"></div>
          <Metamask
            walletConnected={walletConnected}
            setWalletConnected={setWalletConnected}
            web3ModalRef={web3ModalRef}
          />
        </div>
      </nav>
      <main role="main">
        <div className="jumbotron">
          <div className="container">
            <div className="row">
              <div className="col-sm-12">
                <h2 className="display-4">NFT Bridge</h2>
                <p>
                  Project to bridge NFTs, enter contract id below to see your
                  NFTs
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="container">
          <div className="row gy-3">
            {tokens.map((item) => (
              <div className="col-lg-4 col-md-6" key={item.id}>
                <div className="card">
                  <img
                    src={item.image}
                    className="card-img-top"
                    alt={item.description}
                  />
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title">{item.name}</h5>
                    <hr />
                    <p className="card-text">{item.description}</p>
                    {item.canTransfer && (
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => transfer(item.id)}
                      >
                        Transfer
                      </button>
                    )}
                    {item.canReturn && (
                      <button
                        className="btn btn-outline-success"
                        onClick={() => sendBack(item.id, item.address)}
                      >
                        Send back
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
