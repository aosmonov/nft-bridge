import React, { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import Web3Modal from "web3modal";

const Metamask = ({ walletConnected, setWalletConnected, web3ModalRef }) => {
  const [connectedAddress, setConnectedAddress] = useState("");

  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new ethers.providers.Web3Provider(provider);

    if (needSigner) {
      const signer = await web3Provider.getSigner().getAddress();
      setConnectedAddress(signer);

      return signer;
    }

    return web3Provider;
  };

  const connectWallet = async () => {
    try {
      await getProviderOrSigner(true);
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleClick = async () => {
    if (walletConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const connect = async () => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: 97,
        providerOptions: {},
        disableInjectedProvider: false,
      });
    }

    connectWallet();
  };

  return walletConnected ? (
    <span className="navbar-text pe-3">{connectedAddress}</span>
  ) : (
    <button className="btn btn-success my-2 my-sm-0" onClick={handleClick}>
      {walletConnected ? "Disconnect" : "Connect"}
    </button>
  );
};

export default Metamask;
