import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function LoginSuccess() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	useEffect(() => {
		const token = searchParams.get("token");
		console.log("LoginSuccess: Received token:", token ? "***" : "null");
		if (token) {
			console.log("LoginSuccess: Setting token to localStorage");
			localStorage.setItem("ziji-token", token);
			console.log("LoginSuccess: Token in localStorage after set:", localStorage.getItem("ziji-token") ? "exists" : "missing");
			window.location.href = "/#/dashboard";
			window.location.reload();
		} else {
			console.error("LoginSuccess: No token found in URL");
			navigate("/");
		}
	}, [searchParams, navigate]);

	return (
		<div className='flex items-center justify-center min-h-screen'>
			<div className='text-center'>
				<div className='w-16 h-16 border-4 border-discord border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
				<p className='text-zinc-400 font-bold uppercase tracking-widest'>Logging you in...</p>
			</div>
		</div>
	);
}
