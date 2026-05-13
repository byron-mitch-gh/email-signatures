import json

class Signature:
    def __init__(self, data):
        # Read in permanent links
        with open('utils/permanent-links.json') as json_file:
            self.perm = json.load(json_file)

        # Read in signature information
        self.data = data    

    def create_signature(self):

        # Retrieve company link
        company = "Spatialedge"
        company_link = self.perm[company]["Link"]
        company_logo = self.perm[company]["Logo"]

        # Ensure profile image is in the correct form
        profile_photo_id = self.data['Profile Image '].split('id=')[1]
        profile_photo = f'https://drive.google.com/uc?id={profile_photo_id}'

        # Ensure phone number is in the correct form
        phone_num = str(self.data['Phone Number'])
        phone_num = phone_num.replace(' ','')
        phone = "+" + phone_num[0:2] + ' ' + phone_num[-9:4] + ' ' + phone_num[-7:7] + ' ' + phone_num[-4:]

        self.signature = {
                    "profilePhotoSrc": profile_photo,
                    "firstName": self.data['Name and Surname'].split(' ')[0],
                    "surname": self.data['Name and Surname'].split(' ')[1],
                    "jobTitle": self.data['Job Title'],
                    "company": company,
                    "phone": phone,
                    "emailAddress": self.data['Email Address'],
                    "companyWebsiteLink": company_link,
                    "companyLogo": company_logo,
                    }

        return self.data['Email address']