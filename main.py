# importing the required libraries
import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
from pybars import Compiler
from mailer import Mailer
from signature import Signature

def main():
    # define the scope
    scope = ['https://spreadsheets.google.com/feeds','https://www.googleapis.com/auth/drive']

    # add credentials to the account
    creds = ServiceAccountCredentials.from_json_keyfile_name('utils/credentials.json', scope)

    # authorize the clientsheet 
    client = gspread.authorize(creds)

    # get the instance of the Spreadsheet
    sheet = client.open('Contact Details Form (Responses)')

    # get the first sheet of the Spreadsheet
    sheet_instance = sheet.get_worksheet(0)

    # get all the records of the data
    records_data = sheet_instance.get_all_records()

    # convert the json to dataframe
    records_df = pd.DataFrame.from_dict(records_data)

    # Create signature dict(s)
    signature = Signature(data=dict(records_df.iloc[-1]))
    to_email = signature.create_signature()

    # Compile the handlebars template
    compiler = Compiler()
    with open("signature.txt","r") as f:
        source = f.read()

    template = compiler.compile(source)
    output = template(signature.signature)

    # Send email
    mailer = Mailer()
    mailer.send_mail(html=output, to_email=to_email)

if __name__ == "__main__":
    main()