const btn = document.getElementById("sendBtn");
const countBox = document.getElementById("count");

btn.onclick = async () => {
  btn.disabled = true;
  btn.innerText = "Sending...";

  const res = await fetch("/send",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      senderName:senderName.value,
      gmail:gmail.value,
      apppass:apppass.value,
      subject:subject.value,
      message:message.value,
      to:to.value
    })
  });

  const data = await res.json();
  btn.disabled = false;
  btn.innerText = "Send All";
  countBox.innerText = `${data.count || 0}/28`;

  alert(data.success ? "Mail Send Successful ✅" : data.msg);
};

function logout(){
  localStorage.removeItem("auth");
  location.href="/";
}
