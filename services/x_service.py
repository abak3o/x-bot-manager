import tweepy
from services.encryption import decrypt_data
import os

def send_hello_world(account):
    # 1. 保存された情報を復号
    api_key = decrypt_data(account.api_key)
    api_secret = decrypt_data(account.api_secret)
    access_token = decrypt_data(account.access_token)
    access_secret = decrypt_data(account.access_token_secret)

    # 2. X API (v2) クライアントの初期化
    client = tweepy.Client(
        consumer_key=api_key,
        consumer_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_secret
    )

    # 3. 投稿実行
    response = client.create_tweet(text="Hello World! from my Python Bot")
    return response

def send_tweet_with_media(account, text, image_names=None):
    """複数画像対応のツイート投稿関数"""
    # 復号処理
    auth = {
        "ck": decrypt_data(account.api_key),
        "cs": decrypt_data(account.api_secret),
        "at": decrypt_data(account.access_token),
        "as": decrypt_data(account.access_token_secret)
    }

    # v2 API クライアント（ツイート投稿用）
    client = tweepy.Client(
        consumer_key=auth["ck"], consumer_secret=auth["cs"],
        access_token=auth["at"], access_token_secret=auth["as"]
    )

    # 画像がある場合は v1.1 API でアップロード
    media_ids = []
    if image_names and len(image_names) > 0:
        # v1.1 API（メディアアップロード用）
        auth_v1 = tweepy.OAuth1UserHandler(auth["ck"], auth["cs"], auth["at"], auth["as"])
        api_v1 = tweepy.API(auth_v1)
        
        for image_name in image_names[:4]:  # 最大4枚まで
            image_path = f"static/uploads/{account.id}/{image_name}"
            if os.path.exists(image_path):
                media = api_v1.media_upload(filename=image_path)
                media_ids.append(media.media_id)
    
    # テキストまたは画像のどちらかが必須
    if not text and not media_ids:
        raise ValueError("テキストまたは画像が必要です")
    
    # 投稿実行
    if media_ids:
        return client.create_tweet(text=text or "", media_ids=media_ids)
    else:
        return client.create_tweet(text=text)
