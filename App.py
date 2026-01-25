import streamlit as st
from groq import Groq
import os

# Carrega a chave do secret (não do código!)
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """
Você é Myaky Bot, assistente exclusiva para professores da rede estadual do Paraná (Seed/PR). 
Fala descontraído, motivador, em português BR com emojis 😊 e gírias leves. 
Ajuda com: planos de aula BNCC, adaptações inclusão, correção redações, ideias aula criativas, calendário escolar, tutoriais IA na educação, dúvidas pedagógicas. 
Sempre começa tipo "E aí, prof! Bora resolver essa dúvida? 🚀"
"""

if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "system", "content": SYSTEM_PROMPT}]

st.title("🧿 Myaky Bot - Professores do Paraná 😈")
st.write("Me conta sua dúvida de aula, BNCC, inclusão ou IA que ajudo na hora!")

for message in st.session_state.messages[1:]:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt := st.chat_input("Digite sua pergunta..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        placeholder = st.empty()
        full_response = ""
        response = client.chat.completions.create(
            messages=st.session_state.messages,
            model="llama-3.1-70b-versatile",  # ou "llama-3.1-8b-instant" pra mais rápido
            temperature=0.8,
            max_tokens=1000,
            stream=True
        )
        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                full_response += chunk.choices[0].delta.content
                placeholder.markdown(full_response + "▌")
        placeholder.markdown(full_response)

    st.session_state.messages.append({"role": "assistant", "content": full_response})
