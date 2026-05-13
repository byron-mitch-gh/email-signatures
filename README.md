# Automate Email Signatures
This will create an email signature for the last entry in the 'Contact Details Form (Responses)' excel spreadsheet.

Run the following steps to create and email the signature to the relevant person:
1. `pip install -r requirements.txt` in your shell
2. `python main.py`

# Fixing SMTP Authentication Error

If it refuses to run and give an SMTP authentication error, do the following:

1. go to google account settings for "marketing@cape-ai.com".
2. generate a new app password.
3. replace the code in line 29 "smtp_obj.login(from_email, 'poaptcvfomtfbgcv')" with the new code.
4. save and rerun. 