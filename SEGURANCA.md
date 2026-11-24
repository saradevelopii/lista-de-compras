# Segurança e dados sensíveis

## O que aparece no código e por quê

`js/firebase-config.js` contém a configuração web do Firebase (`apiKey`,
`databaseURL` etc.). Isso é esperado: no Firebase web esses valores identificam
o projeto e vão para o navegador de qualquer jeito, então não dá para esconder
isso num site estático. O que protege o banco são as **regras do Realtime
Database** e a **restrição da chave por domínio**. Faça os dois abaixo.

## 1. Restringir a chave ao seu domínio

1. Google Cloud Console > o projeto do Firebase > APIs e serviços > Credenciais.
2. Abra a chave de API do navegador (a que tem o mesmo valor do `apiKey`).
3. Em "Restrições de aplicativos", escolha "Sites" e adicione:
   `https://saradevelopii.github.io/*`
   (e `http://localhost:*` se quiser continuar testando localmente).
4. Salve. Leva alguns minutos para valer.

Com isso, a chave deixa de funcionar quando copiada para outro site.

## 2. Regras do Realtime Database

Em Realtime Database > Regras, cole e publique:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "listas": {
      "$listaId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChild('nome') && newData.child('nome').isString() && newData.child('nome').val().length <= 200 && (!newData.hasChild('itens') || !newData.child('itens').child('1000').exists())"
      }
    }
  }
}
```

O que isso faz:

- ninguém consegue listar todas as listas do banco (a raiz e `listas` não são legíveis);
- só quem conhece o id de uma lista (o id aleatório que vai no link) lê e edita essa lista;
- uma gravação precisa ter `nome` (texto de até 200 caracteres) e no máximo 1000 itens, o que limita lixo e abuso.

Teste no "Laboratório de testes de regras" antes de publicar e, depois, abra o app
e veja em Sobre se aparece "Última gravação confirmada".

## 3. Limites que continuam existindo

- Quem tem o link de uma lista consegue editá-la. É o modelo de compartilhamento
  do app. Para controle por usuário seria preciso adicionar login (Firebase
  Authentication) e gravar o dono de cada lista.
- App Check (reCAPTCHA) reduz uso por clientes que não são o seu site. É opcional
  e vale ligar se o uso crescer. Acompanhe a aba "Uso" do Realtime Database.

## 4. O que nunca deve entrar no repositório

Chaves de conta de serviço (`*-firebase-adminsdk-*.json`), arquivos `.env`,
tokens e senhas. O `.gitignore` já bloqueia os padrões mais comuns. Se algo assim
for commitado por engano, troque a credencial no console: apagar o arquivo
depois não remove o valor do histórico do Git.

## 5. Direitos sobre o código

O código está sob licença proprietária (veja `LICENSE`). Uma licença define o que
os outros podem fazer, mas não impede tecnicamente a cópia de algo que o navegador
baixa, e repositórios públicos no GitHub podem ser vistos e ganhar fork dentro da
plataforma. Se precisar de mais controle, mantenha o código-fonte num repositório
privado e publique só o resultado.
