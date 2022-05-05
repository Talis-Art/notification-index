import { TerraMessage } from "@subql/types-terra";
import { Msg } from "@terra-money/terra.js";
import { Auction, Sale } from "../types";

import { decodeBase64, minus } from "../utils/helpers";

export const auction = "terra19wka0vfl493ajupk6dm0g8hsa0nfls0m4vq7zw";

export async function handleAuctionMessage(
  msg: TerraMessage<Msg>
): Promise<void> {
  const record = new Auction(`${msg.tx.tx.txhash}-${msg.idx}`);

  try {
    const parsedMsg = msg.msg.toAmino();

    if (parsedMsg.type == "wasm/MsgExecuteContract") {
      const actualMsg = parsedMsg.value.execute_msg;
      const coins = parsedMsg.value.coins[0];
      record.blockHeight = BigInt(msg.block.block.block.header.height);
      record.txHash = msg.tx.tx.txhash;
      record.type = "";
      let isInteractingWithAuctionContract = false;
      let auction_id = -1;

      // handle place_bid | end_auction

      logger.info("msg_auction: " + JSON.stringify(parsedMsg));
      logger.info("key: " + Object.keys(actualMsg)[0]);
      switch (Object.keys(actualMsg)[0]) {
        case "place_bid":
          record.type = "place bid";
          record.denom = coins.denom;
          record.amount = coins.amount;
          auction_id = actualMsg.place_bid.auction_id;
          isInteractingWithAuctionContract = true;
          break;
        case "end_auction":
          record.type = "settle auction";
          auction_id = actualMsg.end_auction.auction_id;
          isInteractingWithAuctionContract = true;
          break;
        default:
      }

      if (isInteractingWithAuctionContract) {
        const details = await getTokenDetailsFromAuctionId(
          auction_id,
          record.blockHeight
        );

        record.tokenID = details.nft_infos.token_id;
        record.collectionID = details.nft_infos.contract_address;
        record.seller = details.creator;

        if (record.type == "end_auction" && details.best_bid) {
          record.buyer = details.best_bid.bidder;
          record.amount = details.best_bid.amount.native[0].amount;
          record.denom = details.best_bid.amount.native[0].denom;
        }
      }
      if (record.type != "") {
        await record.save();
      }
    }
  } catch (error) {
    logger.info("couldn't treat msg: " + error);
  }
}

export async function handleSaleMessage(msg: TerraMessage<Msg>): Promise<void> {
  const record = new Sale(`${msg.tx.tx.txhash}-${msg.idx}`);
  try {
    const parsedMsg = msg.msg.toAmino();
    if (parsedMsg.type == "wasm/MsgExecuteContract") {
      const actualMsg = parsedMsg.value.execute_msg;
      const coins = parsedMsg.value.coins[0];
      record.blockHeight = BigInt(msg.block.block.block.header.height);
      record.txHash = msg.tx.tx.txhash;
      record.tokenID = "";

      if (Object.keys(actualMsg)[0] == "buy_token") {
        record.buyer = parsedMsg.value.sender;
        record.collectionID = actualMsg.cancel_sell.contract_address;
        record.tokenID = actualMsg.cancel_sell.token_id;
        record.denom = coins.denom;
        record.amount = coins.amount;
      }

      if (record.tokenID != "") {
        await record.save();
      }
    }
  } catch (error) {}
}

const getTokenDetailsFromAuctionId = async (auction_id: number, height) => {
  try {
    const details: any = await (global as any).unsafeApi.wasm.contractQuery(
      auction,
      {
        auction_details_by_id: {
          auction_id: auction_id,
        },
      },
      {
        height: Number(minus(height, 1)),
      }
    );

    // index 0 when auction concern a single nft
    return {
      creator: details.creator,
      nft_infos: details.nft_infos[0],
      best_bid: details.best_bid,
    };
  } catch (error) {
    logger.info("error fetching auction details: " + error);
  }
};
