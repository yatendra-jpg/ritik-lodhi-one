const btn = document.getElementById("sendBtn");
const count = document.getElementById("count");

btn.onclick = async () => {
  btn.disabled = true;
  btn.innerText = "Sending...";

  const r = await fetch("/send",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      senderName:senderName.value,
      gmail:gmail.value,
      apppass:apppass.value,
      subject:subject.value,
      message:message.value,
      to:to.value
    })
  });

  const d = await r.json();
  btn.disabled = false;
  btn.innerText = "Send All";

  if(!d.success) return alert(d.msg);
  count.innerText = `${d.count}/28`;
  alert("Mail Sent ✅");
};

function logout(){
  localStorage.removeItem("auth");
  location.href="/";
}
