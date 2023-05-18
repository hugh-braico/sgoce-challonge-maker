# SGOCE Challonge Bracket Maker

Automatic bracket maker for Skullgirls Oceania. Might give you some ideas for
how to automate your own challonge brackets, but this isn't a tool that people
outside SGOCE can pick up.

## How to use from packaged exe

1. Extract the zip file somewhere
2. Fill out credentials.json with your username and API key
3. Run the exe. You will be prompted to type jan, feb, etc.

## How to use from source

```bash
# copy credentials template
cp credentials.json.tmpl credentials.json

# (in a text editor, fill out username and API key in credentials.json)

# install requirements
python -m pip install -r requirements.txt

# run script
python main.py
```

## How to package your own release to exe

```bash
pyinstaller --onefile -i bigband.ico main.py
```