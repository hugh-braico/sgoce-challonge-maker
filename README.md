# SGOCE Challonge Bracket Maker

Automatic bracket maker for Skullgirls Oceania. Might give you some ideas for
how to automate your own challonge brackets, but this isn't a tool that people
outside SGOCE can pick up.

Due to API support the following things still need to be done manually after the fact:

* Setting the game to "Skullgirls"
* Setting the tournament to "Community" so it can be run by accounts other than the SGOCE challonge account
* Setting the signup page to public
* Enabling custom round labels (if you want them)

## How to use from packaged exe

1. Extract the zip file somewhere
2. Fill out credentials.json with your username and API key
3. Run the exe. You will be prompted to type jan, feb, etc.

## How to use from source

```bash
# copy credentials template
cp credentials.json.tmpl credentials.json

# (in a text editor, fill out username and API key in credentials.json)

# run script
python3 main.py
```

## How to package your own release to exe

```bash
pyinstaller --onefile -i bigband.ico main.py
```

## TODO

* Challonge API v2 to have the following two features
    * Creating tournaments under the SkullgirlsOceania "community" 
    * Filling out the game/sport field to be "Skullgirls"
