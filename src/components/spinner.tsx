'use client'
interface SpinnerProps {
    size?: number | string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 40 }) => {
    const style = {
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
    };

    return (
        <div className="spinner-container">
            <div className="spinner" style={style} />
        </div>
    );
};

export default Spinner;