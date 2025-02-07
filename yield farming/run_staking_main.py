import os
from dotenv import load_dotenv
from YieldYakInteractor import YieldYakInteractor
from web3 import Web3

# Load environment variables
load_dotenv()

def main():
    # Retrieve private key from .env
    private_key = os.getenv("PRIVATE_KEY")
    if not private_key:
        raise ValueError("PRIVATE_KEY is missing from the .env file")

    # Initialize Yield Yak Interactor
    strategy = YieldYakInteractor(
        rpc_url="https://api.avax.network/ext/bc/C/rpc",
        
        contract_address="0x0C4684086914D5B1525bf16c62a0FF8010AB991A",
        
        private_key=private_key,  # Use private key from .env
    
    )

    try:
        balance = strategy.w3.eth.get_balance(strategy.account.address)
        print(f"Wallet Balance: {Web3.from_wei(balance, 'ether')} AVAX")

        # Check rewards
        rewards_in_avax = Web3.from_wei(4613802486842282, 'ether')
        print(f"Current rewards in AVAX: {rewards_in_avax}")


        # Get total deposits
        deposits = strategy.get_total_deposits()
        print(f"Total deposits in the pool: {Web3.from_wei(deposits, 'ether')}")

        user_staked_balance = strategy.check_user_staked_balance()
        print(f"Your Staked Balance: {Web3.from_wei(user_staked_balance, 'ether')} AVAX")



        # Example deposit
        # amount_to_deposit = Web3.to_wei(1, 'ether')
        # receipt = strategy.deposit(amount_to_deposit)
        # print(f"Deposit Transaction Hash: {receipt['transactionHash'].hex()}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
